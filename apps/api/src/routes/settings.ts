import { Hono } from 'hono'
import { z } from 'zod'
import {
  closeSalonDates,
  getBusinessSettings,
  listSalonClosureDates,
  reopenSalonDates,
  updateBusinessSettings,
} from '@repo/database/settings'
import { businessSettingsSchema } from '@repo/salon-core/forms/settings'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { ok } from '../lib/responses'

const closureRangeSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine(({ startDate, endDate }, ctx) => {
    if (
      addDaysYmd(startDate, 0) !== startDate ||
      addDaysYmd(endDate, 0) !== endDate ||
      startDate < salonTodayYmd() ||
      endDate < startDate ||
      endDate > addDaysYmd(startDate, 365)
    ) {
      ctx.addIssue({ code: 'custom', message: 'بازه تاریخ نامعتبر است' })
    }
  })

const closeDatesSchema = closureRangeSchema.safeExtend({
  confirmed: z.boolean().optional().default(false),
})

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
  .get('/closures', requireTenant(), async (c) => {
    const { salonId } = c.var.tenant
    const closures = await listSalonClosureDates(salonId, salonTodayYmd())
    return ok(c, { closures: closures.map((row) => row.date) })
  })
  .post(
    '/closures',
    requireTenant('manage_settings'),
    zValidator('json', closeDatesSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const result = await closeSalonDates({
        salonId,
        ...c.req.valid('json'),
      })
      if (!result.ok) {
        return c.json(
          {
            error: 'این بازه نوبت فعال دارد',
            code: 'CLOSURE_CONFIRMATION_REQUIRED',
            appointmentCount: result.appointmentCount,
            appointmentsByDate: result.appointmentsByDate,
          },
          409,
        )
      }
      return ok(c, { dates: result.dates })
    },
  )
  .delete(
    '/closures',
    requireTenant('manage_settings'),
    zValidator('json', closureRangeSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const dates = await reopenSalonDates({
        salonId,
        ...c.req.valid('json'),
      })
      return ok(c, { dates })
    },
  )

export type SettingsRoute = typeof settings
