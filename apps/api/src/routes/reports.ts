import { Hono } from 'hono'
import { getSalonMoneyReport } from '@repo/database/commissions'
import { reportingPeriodRange } from '@repo/salon-core/reporting-period'

import type { AppEnv } from '../factory'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'
import { requireTenant } from '../middleware/auth'
import { salonMoneyReportQuerySchema } from '../openapi/schemas/reports'

export const reports = new Hono<AppEnv>().get(
  '/salon-money',
  requireTenant('manage_settings'),
  zValidator('query', salonMoneyReportQuerySchema),
  async (c) => {
    const { salonId } = c.var.tenant
    const query = c.req.valid('query')
    let range: ReturnType<typeof reportingPeriodRange>
    try {
      range = reportingPeriodRange(query)
    } catch {
      return error(c, 'بازه گزارش معتبر نیست', 400)
    }
    const result = await getSalonMoneyReport({
      salonId,
      staffProfileId: query.staffProfileId,
      serviceId: query.serviceId,
      categoryId: query.categoryId,
      ...range,
    })
    if (!result.ok) {
      if (result.reason === 'staff') return error(c, 'پروفایل پرسنل یافت نشد', 404)
      if (result.reason === 'service') return error(c, 'خدمت یافت نشد', 404)
      return error(c, 'دسته یافت نشد', 404)
    }
    return ok(c, { report: result.report })
  },
)

export type ReportsRoute = typeof reports
