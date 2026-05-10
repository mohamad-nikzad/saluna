import { NextResponse } from 'next/server'
import {
  getBusinessSettings,
  getStaffSchedules,
  getUserById,
  setStaffSchedules,
} from '@repo/database/staff'
import { validateAppointmentWindow } from '@repo/salon-core/appointment-time'
import { getTenantManagerRequest } from '@repo/auth/tenant'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const staff = await getUserById(id)
    if (!staff || staff.salonId !== user.salonId || staff.role !== 'staff') {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    const [schedule, businessHours] = await Promise.all([
      getStaffSchedules(user.salonId, id),
      getBusinessSettings(user.salonId),
    ])

    return NextResponse.json({ schedule, businessHours })
  } catch (error) {
    console.error('Get staff schedule error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const staff = await getUserById(id)
    if (!staff || staff.salonId !== user.salonId || staff.role !== 'staff') {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    const body = (await request.json()) as { schedule?: unknown }
    const rawRows: unknown[] = Array.isArray(body.schedule) ? body.schedule : []
    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'برنامه هفتگی خالی است' }, { status: 400 })
    }

    type BodyRow = {
      dayOfWeek?: unknown
      active?: unknown
      workingStart?: unknown
      workingEnd?: unknown
    }

    const schedule = rawRows.map((row: unknown) => {
      const r = row as BodyRow
      return {
        dayOfWeek: Number(r.dayOfWeek),
        active: Boolean(r.active),
        workingStart: String(r.workingStart ?? ''),
        workingEnd: String(r.workingEnd ?? ''),
      }
    })

    for (const row of schedule) {
      if (!Number.isInteger(row.dayOfWeek) || row.dayOfWeek < 0 || row.dayOfWeek > 6) {
        return NextResponse.json({ error: 'روز هفته نامعتبر است' }, { status: 400 })
      }
      const window = validateAppointmentWindow(row.workingStart, row.workingEnd)
      if (!window.ok) {
        return NextResponse.json({ error: window.error }, { status: 400 })
      }
    }

    const saved = await setStaffSchedules(user.salonId, id, schedule)
    return NextResponse.json({ schedule: saved })
  } catch (error) {
    console.error('Update staff schedule error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
