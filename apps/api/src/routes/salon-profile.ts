import { Hono } from 'hono'
import {
  getSalonPresence,
  updateSalonPresence,
} from '@repo/database/salon-profile'
import { presencePatchSchema } from '@repo/salon-core/forms/presence'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { ok } from '../lib/responses'

export const salonProfile = new Hono<AppEnv>()
  .get('/presence', requireTenant('manage_settings'), async (c) => {
    const { salonId } = c.var.tenant
    const presence = await getSalonPresence(salonId)
    return ok(c, { presence })
  })
  .patch(
    '/presence',
    requireTenant('manage_settings'),
    zValidator('json', presencePatchSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const payload = c.req.valid('json')
      const presence = await updateSalonPresence(salonId, payload)
      return ok(c, { presence })
    },
  )

export type SalonProfileRoute = typeof salonProfile
