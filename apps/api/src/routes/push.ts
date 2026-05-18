import { Hono } from 'hono'
import { z } from 'zod'
import { isWebPushConfigured } from '@repo/notifications'
import {
  deletePushSubscriptionForUser,
  upsertPushSubscription,
} from '@repo/database/push'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { error, ok } from '../lib/responses'

const subscribeBody = z.object({
  subscription: z.object({
    endpoint: z.string().min(1),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

const unsubscribeBody = z.object({
  endpoint: z.string().min(1),
})

export const push = new Hono<AppEnv>()
  .use(requireTenant())
  .get('/config', async (c) => {
    const configured = isWebPushConfigured()
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
    return ok(c, { configured, publicKey: configured ? publicKey : null })
  })
  .post('/subscribe', async (c) => {
    if (!isWebPushConfigured()) {
      return error(c, 'اعلان فشاری پیکربندی نشده است', 503)
    }
    const json = await c.req.json().catch(() => ({}))
    const parsed = subscribeBody.safeParse(json)
    if (!parsed.success) return error(c, 'داده نامعتبر', 400)

    const { salonId, userId } = c.var.tenant
    const { subscription } = parsed.data
    await upsertPushSubscription(userId, salonId, {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    return ok(c, { ok: true })
  })
  .delete('/subscribe', async (c) => {
    const json = await c.req.json().catch(() => ({}))
    const parsed = unsubscribeBody.safeParse(json)
    if (!parsed.success) return error(c, 'داده نامعتبر', 400)

    const { salonId, userId } = c.var.tenant
    await deletePushSubscriptionForUser(userId, salonId, parsed.data.endpoint)
    return ok(c, { ok: true })
  })

export type PushRoute = typeof push
