import { Hono } from 'hono'
import { z } from 'zod'
import {
  checkMessagingLinkRateLimit,
  createLinkToken,
  deleteAccount,
  listAccountsForUser,
  setAccountEnabled,
} from '@repo/database/messaging'
import {
  getMessagingProvider,
  listConfiguredMessagingProviders,
} from '@repo/notifications'
import { getEnv } from '../env'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const providerEnum = z.enum(['telegram', 'bale', 'rubika', 'whatsapp'])
const linkBodySchema = z.object({ provider: providerEnum })
const accountIdSchema = z.object({ id: z.string().guid() })
const patchBodySchema = z.object({ enabled: z.boolean() })

export const messagingRoute = new Hono<AppEnv>()
  .use('*', requireTenant('manage_settings'))
  .post('/link', zValidator('json', linkBodySchema), async (c) => {
    const { userId, salonId } = c.var.tenant
    const { provider } = c.req.valid('json')

    const limit = await checkMessagingLinkRateLimit(userId)
    if (!limit.allowed) {
      c.header('Retry-After', String(Math.ceil(limit.retryAfterMs / 1000)))
      return error(
        c,
        'تعداد درخواست‌های اتصال بیش از حد مجاز است. لطفاً بعداً تلاش کنید.',
        429,
      )
    }

    const impl = getMessagingProvider(provider)
    if (!impl || !impl.isConfigured()) {
      return error(
        c,
        'این پیام‌رسان در دسترس نیست.',
        400,
        'provider_unavailable',
      )
    }

    const env = getEnv()
    const token = await createLinkToken({
      userId,
      salonId,
      provider,
      ttlMinutes: env.MESSAGING_LINK_TOKEN_TTL_MINUTES,
    })
    const deepLink = impl.buildAccountLinkUrl(token.token)
    if (!deepLink) {
      return error(
        c,
        'لینک اتصال برای این پیام‌رسان پیکربندی نشده است.',
        500,
        'deep_link_unavailable',
      )
    }
    return ok(c, { deepLink, expiresAt: token.expiresAt.toISOString() }, 201)
  })
  .get('/accounts', async (c) => {
    const { userId } = c.var.tenant
    const accounts = await listAccountsForUser(userId)
    return ok(c, {
      providers: listConfiguredMessagingProviders().map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
      })),
      accounts: accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        displayName: a.displayName,
        enabled: a.enabled,
        linkedAt: a.linkedAt.toISOString(),
      })),
    })
  })
  .patch(
    '/accounts/:id',
    zValidator('param', accountIdSchema),
    zValidator('json', patchBodySchema),
    async (c) => {
      const { userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { enabled } = c.req.valid('json')
      const updated = await setAccountEnabled(id, userId, enabled)
      if (!updated) return error(c, 'حساب یافت نشد', 404)
      return ok(c, {
        account: {
          id: updated.id,
          provider: updated.provider,
          displayName: updated.displayName,
          enabled: updated.enabled,
          linkedAt: updated.linkedAt.toISOString(),
        },
      })
    },
  )
  .delete('/accounts/:id', zValidator('param', accountIdSchema), async (c) => {
    const { userId } = c.var.tenant
    const { id } = c.req.valid('param')
    const removed = await deleteAccount(id, userId)
    if (!removed) return error(c, 'حساب یافت نشد', 404)
    return ok(c, { ok: true })
  })

export type MessagingRoute = typeof messagingRoute
