import { Hono } from 'hono'
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
import { idParamSchema } from '../openapi/schemas/common'
import {
  commissionAgreementBodySchema,
  commissionPeriodQuerySchema,
} from '../openapi/schemas/commissions'

export const commissions = new Hono<AppEnv>()
  .put(
    '/staff/:id/agreement',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', commissionAgreementBodySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { percentage } = c.req.valid('json')
      const agreement = await setCommissionAgreement({
        salonId,
        staffProfileId: id,
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
        staffProfileId: id,
      })
      if (!agreement) return error(c, 'توافق کمیسیون یافت نشد', 404)
      return ok(c, { agreement })
    },
  )
  .get(
    '/staff/:id/report',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('query', commissionPeriodQuerySchema),
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
        staffProfileId: id,
        ...range,
      })
      if (!report) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { report })
    },
  )
  .get(
    '/me',
    requireTenant(),
    zValidator('query', commissionPeriodQuerySchema),
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
        staffProfileId: tenant.staffProfileId,
        ...range,
      })
      if (!report) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { report })
    },
  )
  .get(
    '/salon',
    requireTenant('manage_settings'),
    zValidator('query', commissionPeriodQuerySchema),
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
        staffProfileId: query.staffProfileId,
        ...range,
      })
      if (!report) return error(c, 'پروفایل پرسنل یافت نشد', 404)
      return ok(c, { report })
    },
  )

export type CommissionsRoute = typeof commissions
