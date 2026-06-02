import { Hono } from 'hono'
import { z } from 'zod'
import {
  approveAppointmentRequest,
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
})

const approveBodySchema = z.object({ staffId: z.string().min(1) })
const rejectBodySchema = z.object({ reason: z.string().trim().min(1).optional() })

export const appointmentRequestsRoute = new Hono<AppEnv>()
  .use('*', requireTenant('manage_appointments'))
  .get('/', zValidator('query', listQuerySchema), async (c) => {
    const { salonId } = c.var.tenant
    const { status } = c.req.valid('query')
    const list = await listAppointmentRequests(
      salonId,
      status ? { status: status as AppointmentRequestStatus } : {},
    )
    return ok(c, { requests: list })
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
      return ok(c, { appointmentId: result.appointmentId, clientId: result.clientId })
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
