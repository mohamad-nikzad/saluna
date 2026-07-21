import { Hono } from 'hono'
import { z } from 'zod'
import {
  approveAppointmentRequest,
  convertFlexibleAppointmentRequest,
  cancelAppointmentRequest,
  createFlexibleAppointmentRequest,
  listAppointmentRequests,
  rejectAppointmentRequest,
  renewTerminalAppointmentRequest,
  updateFlexibleAppointmentRequest,
  type AppointmentRequestStatus,
} from '@repo/database/appointment-requests'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'
import {
  cancelAppointmentRequestBodySchema,
  createFlexibleAppointmentRequestBodySchema,
  convertFlexibleAppointmentRequestBodySchema,
  renewTerminalAppointmentRequestBodySchema,
  updateFlexibleAppointmentRequestBodySchema,
} from '../openapi/schemas/appointment-requests'

const idParamSchema = z.object({ id: z.string().guid() })

const listQuerySchema = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected', 'cancelled', 'expired'])
    .optional(),
  timingMode: z.enum(['exact', 'flexible']).optional(),
})

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
  .post(
    '/',
    zValidator('json', createFlexibleAppointmentRequestBodySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const result = await createFlexibleAppointmentRequest({
        salonId,
        ...c.req.valid('json'),
      })
      if (!result.ok) return error(c, result.error, result.status)
      return c.json({ request: result.request }, 201)
    },
  )
  .patch(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateFlexibleAppointmentRequestBodySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const result = await updateFlexibleAppointmentRequest({
        id: c.req.valid('param').id,
        salonId,
        ...c.req.valid('json'),
      })
      if (!result.ok) return error(c, result.error, result.status)
      return ok(c, { request: result.request })
    },
  )
  .post(
    '/:id/convert',
    zValidator('param', idParamSchema),
    zValidator('json', convertFlexibleAppointmentRequestBodySchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const result = await convertFlexibleAppointmentRequest({
        id: c.req.valid('param').id,
        salonId,
        reviewedByUserId: userId,
        ...c.req.valid('json'),
      })
      if (!result.ok) {
        return error(
          c,
          result.error,
          result.status as 400 | 404 | 409,
          result.code,
        )
      }
      return ok(c, {
        appointmentId: result.appointmentId,
        clientId: result.clientId,
      })
    },
  )
  .post(
    '/:id/renew',
    zValidator('param', idParamSchema),
    zValidator('json', renewTerminalAppointmentRequestBodySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const result = await renewTerminalAppointmentRequest({
        id: c.req.valid('param').id,
        salonId,
        ...c.req.valid('json'),
      })
      if (!result.ok) return error(c, result.error, result.status)
      return c.json({ request: result.request }, 201)
    },
  )
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
  .post(
    '/:id/cancel',
    zValidator('param', idParamSchema),
    zValidator('json', cancelAppointmentRequestBodySchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { closureNote } = c.req.valid('json')
      const result = await cancelAppointmentRequest({
        id,
        salonId,
        reviewedByUserId: userId,
        ...(closureNote ? { closureNote } : {}),
      })
      if (!result.ok) return error(c, result.error, result.status as 404)
      return ok(c, { ok: true })
    },
  )

export type AppointmentRequestsRoute = typeof appointmentRequestsRoute
