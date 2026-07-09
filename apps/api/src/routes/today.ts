import { Hono } from 'hono'
import { getTodayData } from '@repo/database/dashboard'
import { staffAppointmentStaffIds } from '@repo/auth/tenant'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { ok } from '../lib/responses'

export const today = new Hono<AppEnv>()
  .use(requireTenant())
  .get('/', async (c) => {
    const tenant = c.var.tenant
    const date = c.req.query('date') || salonTodayYmd()
    const staffFilter = staffAppointmentStaffIds(tenant)
    const data = await getTodayData(tenant.salonId, date, staffFilter)
    return ok(c, data)
  })

export type TodayRoute = typeof today
