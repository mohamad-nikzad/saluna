import { Hono } from 'hono'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@repo/notifications'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { error, ok } from '../lib/responses'

const booleanKeys = [
  'appointmentAlertsEnabled',
  'localAlertsEnabled',
  'smsAlertsEnabled',
] as const

type PreferencesPatch = Partial<Record<(typeof booleanKeys)[number], boolean>>

export const notificationPreferences = new Hono<AppEnv>()
  .use(requireTenant())
  .get('/', async (c) => {
    const { salonId, userId } = c.var.tenant
    const preferences = await getNotificationPreferences(salonId, userId)
    return ok(c, { preferences })
  })
  .patch('/', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const patch: PreferencesPatch = {}
    for (const key of booleanKeys) {
      if (body[key] === undefined) continue
      if (typeof body[key] !== 'boolean') {
        return error(c, 'مقدار تنظیمات اعلان نامعتبر است', 400)
      }
      patch[key] = body[key] as boolean
    }
    const { salonId, userId } = c.var.tenant
    const preferences = await updateNotificationPreferences(salonId, userId, patch)
    return ok(c, { preferences })
  })

export type NotificationPreferencesRoute = typeof notificationPreferences
