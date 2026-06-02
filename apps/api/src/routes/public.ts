import { Hono } from 'hono'
import { z } from 'zod'
import {
  cancelAppointmentRequestByToken,
  createAppointmentRequest,
  getAppointmentRequestByToken,
  getPublicAvailability,
  getPublicSalon,
} from '@repo/database/public'
import { checkAndRecordPublicSubmit } from '@repo/database/rate-limit'
import { publicAppointmentRequestSchema } from '@repo/salon-core/forms/public'
import { notifyManagersOfNewAppointmentRequest } from '@repo/notifications'
import { getEnv } from '../env'
import type { AppEnv } from '../factory'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const slugParamSchema = z.object({ slug: z.string().min(1) })
const slugTokenParamSchema = z.object({
  slug: z.string().min(1),
  token: z.string().guid(),
})

const availabilityQuerySchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ نامعتبر است'),
  mode: z.enum(['day', 'nearest']).optional().default('day'),
  days: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().max(60).optional()),
})

function extractIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri
  return 'unknown'
}

export const publicRoutes = new Hono<AppEnv>()
  .get('/salons/:slug', zValidator('param', slugParamSchema), async (c) => {
    const { slug } = c.req.valid('param')
    const result = await getPublicSalon(slug)
    if (!result.ok) return error(c, result.error, result.status as 404)
    return ok(c, result.view)
  })
  .get(
    '/salons/:slug/availability',
    zValidator('param', slugParamSchema),
    zValidator('query', availabilityQuerySchema),
    async (c) => {
      const { slug } = c.req.valid('param')
      const { serviceId, date, mode, days } = c.req.valid('query')
      const result = await getPublicAvailability({
        slug,
        serviceId,
        date,
        mode,
        ...(days !== undefined ? { nearestDays: days } : {}),
      })
      if (!result.ok) return error(c, result.error, result.status as 400)
      return ok(c, result.response)
    },
  )
  .post(
    '/salons/:slug/appointment-requests',
    zValidator('param', slugParamSchema),
    zValidator('json', publicAppointmentRequestSchema),
    async (c) => {
      const { slug } = c.req.valid('param')
      const body = c.req.valid('json')
      const ip = extractIp(c.req.raw)
      const limit = await checkAndRecordPublicSubmit(ip)
      if (!limit.allowed) {
        c.header('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)))
        return error(c, 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً تلاش کنید.', 429)
      }
      const result = await createAppointmentRequest({
        slug,
        serviceId: body.serviceId,
        date: body.date,
        startTime: body.startTime,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        ...(body.notes ? { notes: body.notes } : {}),
      })
      if (!result.ok) return error(c, result.error, result.status as 400)
      // Fire-and-forget manager notifications. Never block the public submit
      // response on notification delivery; failures are logged + recorded in
      // notification_deliveries by the dispatcher itself.
      void notifyManagersOfNewAppointmentRequest(result.id, {
        publicAppBaseUrl: getEnv().PUBLIC_APP_BASE_URL,
      }).catch((err) => {
        console.error('[public] failed to notify managers of new request', { requestId: result.id, err })
      })
      return ok(c, { token: result.confirmationToken }, 201)
    },
  )
  .get(
    '/salons/:slug/appointment-requests/:token',
    zValidator('param', slugTokenParamSchema),
    async (c) => {
      const { token } = c.req.valid('param')
      const view = await getAppointmentRequestByToken(token)
      if (!view) return error(c, 'درخواست یافت نشد', 404)
      return ok(c, view)
    },
  )
  .post(
    '/salons/:slug/appointment-requests/:token/cancel',
    zValidator('param', slugTokenParamSchema),
    async (c) => {
      const { token } = c.req.valid('param')
      const result = await cancelAppointmentRequestByToken(token)
      if (!result.ok) return error(c, result.error, result.status as 404)
      return ok(c, { ok: true })
    },
  )

export type PublicRoutes = typeof publicRoutes
