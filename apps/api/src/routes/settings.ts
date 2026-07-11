import { Hono } from 'hono'
import {
  getBusinessSettings,
  updateBusinessSettings,
} from '@repo/database/settings'
import { businessSettingsSchema } from '@repo/salon-core/forms/settings'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { ok } from '../lib/responses'

export const settings = new Hono<AppEnv>()
  .get('/business', requireTenant(), async (c) => {
    const { salonId } = c.var.tenant
    const settings = await getBusinessSettings(salonId)
    return ok(c, { settings })
  })
  .patch(
    '/business',
    requireTenant('manage_settings'),
    zValidator('json', businessSettingsSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { workingStart, workingEnd, slotDurationMinutes, workingDays } =
        c.req.valid('json')
      const next = await updateBusinessSettings(salonId, {
        ...(workingStart !== undefined ? { workingStart } : {}),
        ...(workingEnd !== undefined ? { workingEnd } : {}),
        ...(slotDurationMinutes !== undefined ? { slotDurationMinutes } : {}),
        ...(workingDays !== undefined ? { workingDays } : {}),
      })
      return ok(c, { settings: next })
    },
  )

export type SettingsRoute = typeof settings
