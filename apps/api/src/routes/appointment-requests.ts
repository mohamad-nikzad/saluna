import { Hono } from 'hono'
import { z } from 'zod'
import {
  approveAppointmentRequest,
  createFlexibleAppointmentRequest,
  listAppointmentRequests,
  rejectAppointmentRequest,
  type AppointmentRequestStatus,
} from '@repo/database/appointment-requests'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().guid() })

const listQuerySchema = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected', 'cancelled', 'expired'])
    .optional(),
  timingMode: z.enum(['exact', 'flexible']).optional(),
})

const createFlexibleBodySchema = z
  .object({
    clientId: z.string().guid(),
    serviceId: z.string().guid(),
    acceptableDates: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .min(1)
      .refine((dates) =>
        dates.every((date) => {
          const parsed = new Date(`${date}T00:00:00Z`)
          return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === date
          )
        }),
      )
      .refine((dates) => new Set(dates).size === dates.length),
    timePreference: z.enum(['morning', 'afternoon', 'evening', 'any']),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()

const approveBodySchema = z.object({ staffId: z.string().min(1) })
const rejectBodySchema = z.object({
  reason: z.string().trim().min(1).optional(),
})

export const appointmentRequestsRoute = new Hono<AppEnv>()
  .use('*', requireTenant('manage_appointments'))
  .get('/', zValidator('query', listQuerySchema), async (c) => {
    const { salonId } = c.var.tenant
    const { status, timingMode } = c.req.valid('query')
    const list = await listAppointmentRequests(salonId, {
      ...(status ? { status: status as AppointmentRequestStatus } : {}),
      ...(timingMode ? { timingMode } : {}),
    })
    return ok(c, { requests: list })
  })
  .post('/', zValidator('json', createFlexibleBodySchema), async (c) => {
    const { salonId } = c.var.tenant
    const result = await createFlexibleAppointmentRequest({
      salonId,
      ...c.req.valid('json'),
    })
    if (!result.ok) return error(c, result.error, result.status)
    return c.json({ request: result.request }, 201)
  })
  .post(
    '/:id/approve',
    zValidator('param', idParamSchema),
    zValidator('json', approveBodySchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { staffId } = c.req.valid('json')
      const result = await approveAppointmentRequest({
        id,
        salonId,
        staffId,
        reviewedByUserId: userId,
      })
      if (!result.ok) {
        return error(c, result.error, result.status as 404, result.code)
      }
      return ok(c, {
        appointmentId: result.appointmentId,
        clientId: result.clientId,
      })
    },
  )
  .post(
    '/:id/reject',
    zValidator('param', idParamSchema),
    zValidator('json', rejectBodySchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { reason } = c.req.valid('json')
      const result = await rejectAppointmentRequest({
        id,
        salonId,
        reviewedByUserId: userId,
        ...(reason ? { reason } : {}),
      })
      if (!result.ok) return error(c, result.error, result.status as 404)
      return ok(c, { ok: true })
    },
  )

export type AppointmentRequestsRoute = typeof appointmentRequestsRoute
