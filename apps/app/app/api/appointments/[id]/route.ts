import { NextResponse } from 'next/server'
import type { Appointment } from '@repo/salon-core/types'
import {
  getAppointmentById,
  getAppointmentWithDetailsById,
  updateAppointment,
  deleteAppointment,
  validateUpdateAppointmentIntake,
} from '@repo/database/appointments'
import {
  cancelIncompletePlaceholderAppointment,
  cleanupPlaceholderAfterAppointmentMutation,
  createPlaceholderClient,
  deletePlaceholderClientIfOrphaned,
  getClientById,
  updateClient,
} from '@repo/database/clients'
import { getTenantManagerRequest, getTenantRequest, isManagerRole } from '@repo/auth/tenant'

const STAFF_STATUS_UPDATES: ReadonlySet<Appointment['status']> = new Set([
  'confirmed',
  'completed',
  'no-show',
])

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const appointment = await getAppointmentWithDetailsById(id, user.salonId)

    if (!appointment) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    if (user.role === 'staff' && appointment.staffId !== user.userId) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    console.error('Get appointment error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let createdPlaceholderId: string | null = null
  let placeholderSalonId: string | null = null
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant
    placeholderSalonId = user.salonId

    const { id } = await params
    const body = await request.json()
    const { status, placeholderClient } = body

    const existing = await getAppointmentById(id, user.salonId)
    if (!existing) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }
    const existingClient = await getClientById(existing.clientId, user.salonId)
    if (!existingClient) {
      return NextResponse.json({ error: 'مشتری یافت نشد' }, { status: 404 })
    }

    const isStatusOnlyPatch =
      Object.keys(body).every((key) => key === 'status') &&
      typeof status === 'string'

    if (!isManagerRole(user.role)) {
      const staffCanPatchOwnStatus =
        user.role === 'staff' &&
        existing.staffId === user.userId &&
        isStatusOnlyPatch &&
        STAFF_STATUS_UPDATES.has(status as Appointment['status'])

      if (!staffCanPatchOwnStatus) {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      }
    }

    let resolvedBody = body
    let existingPlaceholderPatch:
      | {
          name: string
          notes?: string
        }
      | null = null
    if (
      placeholderClient &&
      typeof placeholderClient === 'object' &&
      typeof placeholderClient.name === 'string'
    ) {
      const name = placeholderClient.name.trim()
      const notes =
        typeof placeholderClient.notes === 'string' && placeholderClient.notes.trim() !== ''
          ? placeholderClient.notes.trim()
          : undefined

      if (!name) {
        return NextResponse.json({ error: 'نام مشتری موقت الزامی است' }, { status: 400 })
      }

      if (existingClient.isPlaceholder) {
        existingPlaceholderPatch = { name, notes }
        resolvedBody = {
          ...body,
          clientId: existingClient.id,
        }
      } else {
        const placeholder = await createPlaceholderClient({
          salonId: user.salonId,
          name,
          notes,
        })
        createdPlaceholderId = placeholder.id
        resolvedBody = {
          ...body,
          clientId: placeholder.id,
        }
      }
    }

    if (
      isManagerRole(user.role) &&
      status === 'cancelled' &&
      existingClient.isPlaceholder
    ) {
      const cancelled = await cancelIncompletePlaceholderAppointment({
        salonId: user.salonId,
        appointmentId: id,
      })
      if (!cancelled.ok) {
        return NextResponse.json(
          { error: cancelled.error, ...(cancelled.code ? { code: cancelled.code } : {}) },
          { status: cancelled.status }
        )
      }

      return NextResponse.json({
        success: true,
        removedAppointmentId: id,
        cleanup: true,
      })
    }

    const intake = await validateUpdateAppointmentIntake({
      salonId: user.salonId,
      appointmentId: id,
      existing,
      body: resolvedBody,
    })
    if (!intake.ok) {
      if (createdPlaceholderId) {
        await deletePlaceholderClientIfOrphaned(createdPlaceholderId, user.salonId)
      }
      return NextResponse.json(
        { error: intake.error, ...(intake.code ? { code: intake.code } : {}) },
        { status: intake.status }
      )
    }

    const appointment = await updateAppointment(id, user.salonId, intake.patch)

    if (!appointment) {
      return NextResponse.json({ error: 'به‌روزرسانی انجام نشد' }, { status: 500 })
    }

    if (existingPlaceholderPatch) {
      await updateClient(existingClient.id, user.salonId, {
        name: existingPlaceholderPatch.name,
        notes: existingPlaceholderPatch.notes,
        phone: null,
        isPlaceholder: true,
      })
    }

    await cleanupPlaceholderAfterAppointmentMutation({
      salonId: user.salonId,
      previousClientId: existingClient.id,
      nextClientId: appointment.clientId,
    })

    const detail = await getAppointmentWithDetailsById(appointment.id, user.salonId)

    return NextResponse.json({
      appointment: detail ?? {
        ...appointment,
        client: intake.client,
        staff: intake.staff,
        service: intake.service,
      },
    })
  } catch (error) {
    if (createdPlaceholderId && placeholderSalonId) {
      await deletePlaceholderClientIfOrphaned(createdPlaceholderId, placeholderSalonId).catch(
        () => {}
      )
    }
    console.error('Update appointment error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const existing = await getAppointmentById(id, user.salonId)
    const deleted = await deleteAppointment(id, user.salonId)

    if (!deleted) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    if (existing) {
      await cleanupPlaceholderAfterAppointmentMutation({
        salonId: user.salonId,
        previousClientId: existing.clientId,
        deletedAppointmentId: id,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete appointment error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
