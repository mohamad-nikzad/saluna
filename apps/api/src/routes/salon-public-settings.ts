import { Hono } from 'hono'
import {
  getManagerPublicSettings,
  updateManagerPublicSettings,
} from '@repo/database/public'
import { publicSettingsSchema } from '@repo/salon-core/forms/public'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { ok } from '../lib/responses'

export const salonPublicSettings = new Hono<AppEnv>()
  .get('/', requireTenant('manage_settings'), async (c) => {
    const { salonId } = c.var.tenant
    const result = await getManagerPublicSettings(salonId)
    return ok(c, result)
  })
  .put(
    '/',
    requireTenant('manage_settings'),
    zValidator('json', publicSettingsSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const payload = c.req.valid('json')
      const result = await updateManagerPublicSettings(salonId, payload)
      return ok(c, result)
    },
  )

export type SalonPublicSettingsRoute = typeof salonPublicSettings
