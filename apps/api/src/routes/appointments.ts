import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import type { Appointment } from '@repo/salon-core/types'
import type { AvailabilityMode } from '@repo/salon-core/availability'
import { dayOfWeekFromDate } from '@repo/salon-core/staff-availability'
import {
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getAppointmentWithDetailsById,
  getAppointmentsWithDetailsByDateRange,
  getManagerAppointmentAvailability,
  updateAppointment,
  validateCreateAppointmentIntake,
  validateUpdateAppointmentIntake,
} from '@repo/database/appointments'
import {
  cancelIncompletePlaceholderAppointment,
  cleanupPlaceholderAfterAppointmentMutation,
  completePlaceholderAppointmentClient,
  createPlaceholderClient,
  deletePlaceholderClientIfOrphaned,
  getClientById,
  updateClient,
} from '@repo/database/clients'
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  completePlaceholderClientSchema,
} from '@repo/salon-core/forms/appointment'
import {
  isWebPushConfigured,
  notifyStaffOfAppointmentCreated,
  sendWebPushToUser,
} from '@repo/notifications'
import {
  isManagerRole,
  staffAppointmentStaffIds,
  staffOwnsAppointment,
} from '@repo/auth/tenant'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })

const listQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const availabilityQuerySchema = z.object({
  mode: z.string().optional(),
  serviceId: z.string().optional(),
  date: z.string().optional(),
  staffId: z.string().optional(),
})

const STAFF_STATUS_UPDATES: ReadonlySet<Appointment['status']> = new Set([
  'confirmed',
  'completed',
  'no-show',
])

function isAvailabilityMode(value: string | undefined): value is AvailabilityMode {
  return value === 'day' || value === 'nearest'
}

function isIsoDate(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dayOfWeekFromDate(value) >= 0
  )
}

export const appointments = new Hono<AppEnv>()
  .get(
    '/',
    requireTenant(),
    zValidator('query', listQuerySchema),
    async (c) => {
      const tenant = c.var.tenant
      const { startDate, endDate } = c.req.valid('query')
      if (!startDate || !endDate) {
        return error(c, 'تاریخ شروع و پایان الزامی است', 400)
      }
      const staffFilter = staffAppointmentStaffIds(tenant)
      const list = await getAppointmentsWithDetailsByDateRange(
        tenant.salonId,
        startDate,
        endDate,
        staffFilter,
      )
      return ok(c, { appointments: list })
    },
  )
  .post(
    '/',
    requireTenant('manage_settings'),
    zValidator('json', appointmentCreateSchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const {
        clientId,
        placeholderClient,
        staffId,
        serviceId,
        addonIds,
        date,
        startTime,
        endTime: endTimeRaw,
        durationMinutes,
        notes,
        id: requestedAppointmentId,
      } = c.req.valid('json')

      let resolvedClientId = clientId
      let createdPlaceholderId: string | null = null

      try {
        if (placeholderClient) {
          const placeholder = await createPlaceholderClient({
            salonId,
            name: placeholderClient.name,
            notes: placeholderClient.notes,
          })
          resolvedClientId = placeholder.id
          createdPlaceholderId = placeholder.id
        }

        const intake = await validateCreateAppointmentIntake({
          salonId,
          clientId: resolvedClientId,
          staffId,
          serviceId,
          date,
          startTime,
          endTime: endTimeRaw,
          durationMinutes,
          addonIds,
          notes,
          requestedAppointmentId,
        })
        if (!intake.ok) {
          if (createdPlaceholderId) {
            await deletePlaceholderClientIfOrphaned(createdPlaceholderId, salonId)
          }
          return error(c, intake.error, intake.status as ContentfulStatusCode, intake.code)
        }

        const appointment = await createAppointment(intake.command, salonId, userId)

        const staffNotification = await notifyStaffOfAppointmentCreated({
          salonId,
          staffId: intake.staff.id,
          actorUserId: userId,
          appointment: {
            id: appointment.id,
            date: appointment.date,
            startTime: appointment.startTime,
            clientId: appointment.clientId,
            staffId: appointment.staffId,
            serviceId: appointment.serviceId,
          },
          clientName: intake.client.name,
          serviceName: intake.service.name,
        })

        if (isWebPushConfigured() && staffNotification) {
          void sendWebPushToUser(staffNotification.userId, {
            title: staffNotification.title,
            body: staffNotification.body,
            url: `/calendar?date=${appointment.date}&appointmentId=${appointment.id}`,
            tag: `appointment-${appointment.id}`,
          })
        }

        const detail = await getAppointmentWithDetailsById(appointment.id, salonId)

        return ok(c, {
          appointment: detail ?? {
            ...appointment,
            client: intake.client,
            staff: intake.staff,
            service: intake.service,
          },
        })
      } catch (err) {
        if (createdPlaceholderId) {
          await deletePlaceholderClientIfOrphaned(createdPlaceholderId, salonId).catch(
            () => {},
          )
        }
        throw err
      }
    },
  )
  .get(
    '/availability',
    requireTenant('manage_settings'),
    zValidator('query', availabilityQuerySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { mode, serviceId, date, staffId } = c.req.valid('query')

      if (!isAvailabilityMode(mode)) {
        return error(c, 'نوع جستجو نامعتبر است', 400)
      }
      if (!serviceId) {
        return error(c, 'خدمت الزامی است', 400)
      }
      if (!isIsoDate(date)) {
        return error(c, 'تاریخ نامعتبر است', 400)
      }

      const result = await getManagerAppointmentAvailability({
        salonId,
        serviceId,
        date,
        mode,
        staffId,
      })

      if (!result.ok) {
        return error(c, result.error, result.status as ContentfulStatusCode)
      }
      return ok(c, result.response)
    },
  )
  .get(
    '/:id',
    requireTenant(),
    zValidator('param', idParamSchema),
    async (c) => {
      const tenant = c.var.tenant
      const { id } = c.req.valid('param')
      const appointment = await getAppointmentWithDetailsById(id, tenant.salonId)
      if (!appointment) return error(c, 'نوبت یافت نشد', 404)
      if (
        tenant.role === 'staff' &&
        !staffOwnsAppointment(appointment.staffId, tenant)
      ) {
        return error(c, 'دسترسی غیرمجاز', 403)
      }
      return ok(c, { appointment })
    },
  )
  .patch(
    '/:id',
    requireTenant(),
    zValidator('param', idParamSchema),
    zValidator('json', appointmentUpdateSchema),
    async (c) => {
      const tenant = c.var.tenant
      const { salonId, role } = tenant
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const { status, placeholderClient } = body

      const existing = await getAppointmentById(id, salonId)
      if (!existing) return error(c, 'نوبت یافت نشد', 404)
      const existingClient = await getClientById(existing.clientId, salonId)
      if (!existingClient) return error(c, 'مشتری یافت نشد', 404)

      const isStatusOnlyPatch =
        Object.keys(body).every((key) => key === 'status') &&
        typeof status === 'string'

      if (!isManagerRole(role)) {
        const staffCanPatchOwnStatus =
          role === 'staff' &&
          staffOwnsAppointment(existing.staffId, tenant) &&
          isStatusOnlyPatch &&
          STAFF_STATUS_UPDATES.has(status as Appointment['status'])
        if (!staffCanPatchOwnStatus) {
          return error(c, 'دسترسی غیرمجاز', 403)
        }
      }

      let createdPlaceholderId: string | null = null
      try {
        let resolvedBody = body
        let existingPlaceholderPatch:
          | { name: string; notes?: string }
          | null = null

        if (
          placeholderClient &&
          typeof placeholderClient === 'object' &&
          typeof placeholderClient.name === 'string'
        ) {
          const name = placeholderClient.name.trim()
          const notes =
            typeof placeholderClient.notes === 'string' &&
            placeholderClient.notes.trim() !== ''
              ? placeholderClient.notes.trim()
              : undefined

          if (!name) return error(c, 'نام مشتری موقت الزامی است', 400)

          if (existingClient.isPlaceholder) {
            existingPlaceholderPatch = { name, notes }
            resolvedBody = { ...body, clientId: existingClient.id }
          } else {
            const placeholder = await createPlaceholderClient({
              salonId,
              name,
              notes,
            })
            createdPlaceholderId = placeholder.id
            resolvedBody = { ...body, clientId: placeholder.id }
          }
        }

        if (
          isManagerRole(role) &&
          status === 'cancelled' &&
          existingClient.isPlaceholder
        ) {
          const cancelled = await cancelIncompletePlaceholderAppointment({
            salonId,
            appointmentId: id,
          })
          if (!cancelled.ok) {
            return error(
              c,
              cancelled.error,
              cancelled.status as ContentfulStatusCode,
              cancelled.code,
            )
          }
          return ok(c, {
            success: true,
            removedAppointmentId: id,
            cleanup: true,
          })
        }

        const intake = await validateUpdateAppointmentIntake({
          salonId,
          appointmentId: id,
          existing,
          body: resolvedBody,
        })
        if (!intake.ok) {
          if (createdPlaceholderId) {
            await deletePlaceholderClientIfOrphaned(createdPlaceholderId, salonId)
          }
          return error(c, intake.error, intake.status as ContentfulStatusCode, intake.code)
        }

        const appointment = await updateAppointment(id, salonId, intake.patch)
        if (!appointment) {
          return error(c, 'به‌روزرسانی انجام نشد', 500)
        }

        if (existingPlaceholderPatch) {
          await updateClient(existingClient.id, salonId, {
            name: existingPlaceholderPatch.name,
            notes: existingPlaceholderPatch.notes,
            phone: null,
            isPlaceholder: true,
          })
        }

        await cleanupPlaceholderAfterAppointmentMutation({
          salonId,
          previousClientId: existingClient.id,
          nextClientId: appointment.clientId,
        })

        const detail = await getAppointmentWithDetailsById(appointment.id, salonId)
        return ok(c, {
          appointment: detail ?? {
            ...appointment,
            client: intake.client,
            staff: intake.staff,
            service: intake.service,
          },
        })
      } catch (err) {
        if (createdPlaceholderId) {
          await deletePlaceholderClientIfOrphaned(createdPlaceholderId, salonId).catch(
            () => {},
          )
        }
        throw err
      }
    },
  )
  .delete(
    '/:id',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const existing = await getAppointmentById(id, salonId)
      const deleted = await deleteAppointment(id, salonId)
      if (!deleted) return error(c, 'نوبت یافت نشد', 404)
      if (existing) {
        await cleanupPlaceholderAfterAppointmentMutation({
          salonId,
          previousClientId: existing.clientId,
          deletedAppointmentId: id,
        })
      }
      return ok(c, { success: true })
    },
  )
  .post(
    '/:id/complete-client',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', completePlaceholderClientSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { name, phone, notes, reassignToExistingClientId } = c.req.valid('json')

      const result = await completePlaceholderAppointmentClient({
        salonId,
        appointmentId: id,
        name,
        phone,
        notes,
        reassignToExistingClientId,
      })

      if (!result.ok) {
        const payload: Record<string, unknown> = { error: result.error }
        if (result.code) payload.code = result.code
        if (result.existingClient) payload.existingClient = result.existingClient
        return c.json(payload, result.status as ContentfulStatusCode)
      }

      return ok(c, {
        appointment: result.appointment,
        outcome: result.outcome,
      })
    },
  )

export type AppointmentsRoute = typeof appointments
