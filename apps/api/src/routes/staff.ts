import { Hono } from 'hono'
import { z } from 'zod'
import {
  createUser,
  getAllStaff,
  getBusinessSettings,
  getStaffBookingAvailabilityForSlot,
  getStaffSchedules,
  getUserById,
  getUserWithServiceIds,
  setStaffSchedules,
  setStaffServiceIds,
  validateActiveServiceIds,
} from '@repo/database/staff'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { validateAppointmentWindow } from '@repo/salon-core/appointment-time'
import {
  staffCreateSchema,
  staffScheduleRequestSchema,
  staffServiceIdsSchema,
} from '@repo/salon-core/forms/staff'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })

const bookingAvailabilityQuerySchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
})

function isDuplicatePhoneError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return msg.includes('unique') || msg.includes('duplicate')
}

export const staff = new Hono<AppEnv>()
  .get('/', requireTenant(), async (c) => {
    const { salonId } = c.var.tenant
    const list = await getAllStaff(salonId)
    return ok(c, { staff: list })
  })
  .post(
    '/',
    requireTenant('manage_settings'),
    zValidator('json', staffCreateSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { password, name, role, phone } = c.req.valid('json')

      const existingStaff = await getAllStaff(salonId)
      const colorIndex = existingStaff.length % STAFF_COLORS.length
      const color = normalizeCalendarColorId(STAFF_COLORS[colorIndex])

      try {
        const newUser = await createUser({
          phone,
          password,
          name,
          role: role || 'staff',
          color,
          salonId,
        })
        return ok(c, { user: newUser })
      } catch (err) {
        if (isDuplicatePhoneError(err)) {
          return error(c, 'این شماره موبایل قبلاً ثبت شده است', 409)
        }
        throw err
      }
    },
  )
  .get(
    '/booking-availability',
    requireTenant('manage_settings'),
    zValidator('query', bookingAvailabilityQuerySchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { date, startTime, endTime } = c.req.valid('query')
      if (!date || !startTime || !endTime) {
        return error(c, 'تاریخ و ساعت شروع و پایان الزامی است', 400)
      }
      const windowCheck = validateAppointmentWindow(startTime, endTime)
      if (!windowCheck.ok) {
        return error(c, windowCheck.error, 400)
      }
      const list = await getStaffBookingAvailabilityForSlot(
        salonId,
        date,
        startTime,
        endTime,
      )
      return ok(c, { staff: list })
    },
  )
  .get(
    '/:id/schedule',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const target = await getUserById(id)
      if (!target || target.salonId !== salonId || target.role !== 'staff') {
        return error(c, 'پرسنل یافت نشد', 404)
      }
      const [schedule, businessHours] = await Promise.all([
        getStaffSchedules(salonId, id),
        getBusinessSettings(salonId),
      ])
      return ok(c, { schedule, businessHours })
    },
  )
  .put(
    '/:id/schedule',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', staffScheduleRequestSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const target = await getUserById(id)
      if (!target || target.salonId !== salonId || target.role !== 'staff') {
        return error(c, 'پرسنل یافت نشد', 404)
      }
      const { schedule } = c.req.valid('json')
      const saved = await setStaffSchedules(salonId, id, schedule)
      return ok(c, { schedule: saved })
    },
  )
  .patch(
    '/:id/services',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', staffServiceIdsSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id: staffId } = c.req.valid('param')
      const target = await getUserById(staffId)
      if (!target || target.salonId !== salonId) {
        return error(c, 'کاربر یافت نشد', 404)
      }
      if (target.role !== 'staff') {
        return error(
          c,
          'فقط برای اعضای با نقش «پرسنل» می‌توان خدمات تعیین کرد.',
          400,
        )
      }
      const { serviceIds: normalized } = c.req.valid('json')
      if (normalized !== null) {
        const valid = await validateActiveServiceIds(normalized, salonId)
        if (!valid) {
          return error(c, 'یک یا چند شناسه خدمت نامعتبر یا غیرفعال است.', 400)
        }
      }
      await setStaffServiceIds(staffId, normalized, salonId)
      const updated = await getUserWithServiceIds(staffId, salonId)
      if (!updated) {
        return error(c, 'به‌روزرسانی انجام شد اما کاربر بازخوانی نشد', 500)
      }
      return ok(c, { staff: updated })
    },
  )

export type StaffRoute = typeof staff
