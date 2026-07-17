import { Hono } from 'hono'
import { z } from 'zod'
import {
  disableCommissionAgreement,
  getSalonCommissionReport,
  getStaffCommissionReport,
  setCommissionAgreement,
} from '@repo/database/commissions'
import {
  commissionPeriodRange,
  percentageToBasisPoints,
} from '@repo/salon-core/commissions'

import type { AppEnv } from '../factory'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'
import { requireTenant } from '../middleware/auth'

const idParamSchema = z.object({ id: z.string().min(1) })
const agreementSchema = z.object({
  percentage: z.number().superRefine((value, ctx) => {
    try {
      percentageToBasisPoints(value)
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'درصد باید بیشتر از صفر و حداکثر ۱۰۰ با دو رقم اعشار باشد',
      })
    }
  }),
})
const periodQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'custom']).default('today'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  staffProfileId: z.string().optional(),
})

export const commissions = new Hono<AppEnv>()
  .put(
    '/staff/:id/agreement',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', agreementSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { percentage } = c.req.valid('json')
      const agreement = await setCommissionAgreement({
        salonId,
        staffRef: id,
        percentageBasisPoints: percentageToBasisPoints(percentage),
      })
      if (!agreement) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { agreement })
    },
  )
  .delete(
    '/staff/:id/agreement',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const agreement = await disableCommissionAgreement({
        salonId,
        staffRef: id,
      })
      if (!agreement) return error(c, 'توافق کمیسیون یافت نشد', 404)
      return ok(c, { agreement })
    },
  )
  .get(
    '/staff/:id/report',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('query', periodQuerySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      let range: ReturnType<typeof commissionPeriodRange>
      try {
        range = commissionPeriodRange(c.req.valid('query'))
      } catch {
        return error(c, 'بازه گزارش معتبر نیست', 400)
      }
      const report = await getStaffCommissionReport({
        salonId,
        staffRef: id,
        ...range,
      })
      if (!report) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { report })
    },
  )
  .get(
    '/me',
    requireTenant(),
    zValidator('query', periodQuerySchema),
    async (c) => {
      const tenant = c.var.tenant
      if (tenant.role !== 'staff' || !tenant.staffProfileId) {
        return error(c, 'دسترسی غیرمجاز', 403)
      }
      let range: ReturnType<typeof commissionPeriodRange>
      try {
        range = commissionPeriodRange(c.req.valid('query'))
      } catch {
        return error(c, 'بازه گزارش معتبر نیست', 400)
      }
      const report = await getStaffCommissionReport({
        salonId: tenant.salonId,
        staffRef: tenant.staffProfileId,
        ...range,
      })
      if (!report) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { report })
    },
  )
  .get(
    '/salon',
    requireTenant('manage_settings'),
    zValidator('query', periodQuerySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const query = c.req.valid('query')
      let range: ReturnType<typeof commissionPeriodRange>
      try {
        range = commissionPeriodRange(query)
      } catch {
        return error(c, 'بازه گزارش معتبر نیست', 400)
      }
      const report = await getSalonCommissionReport({
        salonId,
        staffRef: query.staffProfileId,
        ...range,
      })
      if (!report) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { report })
    },
  )

export type CommissionsRoute = typeof commissions
