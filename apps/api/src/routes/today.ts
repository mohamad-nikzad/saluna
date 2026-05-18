import { Hono } from 'hono'
import { getTodayData } from '@repo/database/dashboard'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { ok } from '../lib/responses'

export const today = new Hono<AppEnv>()
  .use(requireTenant())
  .get('/', async (c) => {
    const { salonId, role, userId } = c.var.tenant
    const date = c.req.query('date') || salonTodayYmd()
    const staffFilter = role === 'staff' ? userId : undefined
    const data = await getTodayData(salonId, date, staffFilter)
    return ok(c, data)
  })

export type TodayRoute = typeof today
