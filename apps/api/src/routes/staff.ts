import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import {
  getAllStaff,
  getBusinessSettings,
  countManagers,
  deactivateStaffMember,
  getStaffBookingAvailabilityForSlot,
  getStaffSchedules,
  getUserById,
  getUserWithServiceIds,
  setStaffSchedules,
  setStaffServiceIds,
  updateStaffMember,
  updateStaffPassword,
  validateActiveServiceIds,
} from '@repo/database/staff'
import { auth } from '@repo/auth/server'
import { getDb } from '@repo/database/client'
import { isDuplicatePhoneError } from '@repo/database/clients'
import { salonMember, user } from '@repo/database/schema'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { validateAppointmentWindow } from '@repo/salon-core/appointment-time'
import {
  staffCreateRequestSchema,
  staffPasswordRequestSchema,
  staffScheduleRequestSchema,
  staffServiceIdsSchema,
  staffUpdateSchema,
} from '@repo/salon-core/forms/staff'
import { formMessages } from '@repo/salon-core/forms/messages'
import type { AppEnv } from '../factory'
import { requireTenant } from '../middleware/auth'
import { zValidator } from '../lib/validate'
import { brand } from '@repo/brand'
import { error, ok } from '../lib/responses'

const idParamSchema = z.object({ id: z.string().min(1) })

const bookingAvailabilityQuerySchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
})

function isBetterAuthBadRequest(
  err: unknown,
): err is { body?: { message?: string; code?: string } } {
  return (
    typeof err === 'object' &&
    err !== null &&
    ('statusCode' in err || 'status' in err) &&
    ((err as { statusCode?: unknown }).statusCode === 400 ||
      (err as { status?: unknown }).status === 'BAD_REQUEST')
  )
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
    zValidator('json', staffCreateRequestSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { password, name, phone } = c.req.valid('json')

      const existingStaff = await getAllStaff(salonId)
      const colorIndex = existingStaff.length % STAFF_COLORS.length
      const color = normalizeCalendarColorId(STAFF_COLORS[colorIndex])

      let newUserId: string
      try {
        const signUpRes = await auth.api.signUpEmail({
          body: {
            email: `${phone}@${brand.emailLocalDomain}`,
            password,
            name,
            username: phone,
          },
        })
        newUserId = signUpRes.user.id
        await getDb()
          .update(user)
          .set({
            phoneNumber: phone,
            phoneNumberVerified: true,
            displayUsername: phone,
            updatedAt: new Date(),
          })
          .where(eq(user.id, newUserId))
      } catch (err) {
        if (isDuplicatePhoneError(err)) {
          return error(c, 'این شماره موبایل قبلاً ثبت شده است', 409)
        }
        if (isBetterAuthBadRequest(err)) {
          const code = err.body?.code
          const message =
            code === 'PASSWORD_TOO_SHORT'
              ? formMessages.passwordTooShort
              : (err.body?.message ?? 'اطلاعات پرسنل معتبر نیست')
          return error(
            c,
            message,
            400,
            typeof code === 'string' ? code : undefined,
          )
        }
        throw err
      }

      await auth.api.addMember({
        body: { userId: newUserId, role: 'member', organizationId: salonId },
      })

      const db = getDb()
      await db.insert(salonMember).values({
        userId: newUserId,
        organizationId: salonId,
        displayName: name,
        color,
        active: true,
      })

      const newUser = await getUserById(newUserId)
      return ok(c, { user: newUser })
    },
  )
  .patch(
    '/:id',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', staffUpdateSchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const values = c.req.valid('json')
      const target = await getUserById(id)
      if (!target || target.salonId !== salonId) {
        return error(c, 'کاربر یافت نشد', 404)
      }
      if (id === userId && values.role === 'staff') {
        return error(
          c,
          'نقش حساب فعلی خودتان را نمی‌توانید به پرسنل تغییر دهید.',
          400,
        )
      }
      if (target.role === 'manager' && values.role === 'staff') {
        const managerCount = await countManagers(salonId)
        if (managerCount <= 1) {
          return error(c, 'حداقل یک مدیر باید در سالن باقی بماند.', 400)
        }
      }
      let updated: Awaited<ReturnType<typeof updateStaffMember>>
      try {
        updated = await updateStaffMember(salonId, id, values)
      } catch (err) {
        if (isDuplicatePhoneError(err)) {
          return error(c, 'این شماره موبایل قبلاً ثبت شده است', 409)
        }
        throw err
      }
      if (!updated) return error(c, 'کاربر یافت نشد', 404)
      return ok(c, { staff: updated })
    },
  )
  .patch(
    '/:id/password',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    zValidator('json', staffPasswordRequestSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const { password } = c.req.valid('json')
      const target = await getUserById(id)
      if (!target || target.salonId !== salonId) {
        return error(c, 'کاربر یافت نشد', 404)
      }
      const updated = await updateStaffPassword(salonId, id, password)
      if (!updated) return error(c, 'کاربر یافت نشد', 404)
      return ok(c, { success: true })
    },
  )
  .delete(
    '/:id',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      const target = await getUserById(id)
      if (!target || target.salonId !== salonId) {
        return error(c, 'کاربر یافت نشد', 404)
      }
      if (id === userId) {
        return error(c, 'حساب فعلی خودتان را نمی‌توانید حذف کنید.', 400)
      }
      if (target.role === 'manager') {
        const managerCount = await countManagers(salonId)
        if (managerCount <= 1) {
          return error(c, 'حداقل یک مدیر باید در سالن باقی بماند.', 400)
        }
      }
      const deleted = await deactivateStaffMember(salonId, id)
      if (!deleted) return error(c, 'کاربر یافت نشد', 404)
      return ok(c, { success: true })
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
