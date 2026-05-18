import { Hono } from 'hono'
import { getDashboardData } from '@repo/database/dashboard'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { ok } from '../lib/responses'

export const dashboard = new Hono<AppEnv>()
  .use(requireTenant('view_dashboard'))
  .get('/', async (c) => {
    const { salonId } = c.var.tenant
    const data = await getDashboardData(salonId)
    return ok(c, data)
  })

export type DashboardRoute = typeof dashboard
