import { Hono } from 'hono'
import { z } from 'zod'
import {
  getAllStaff,
  getBusinessSettings,
  countManagers,
  cancelManagerStaffInvite,
  createManagerStaffInvite,
  deactivateStaffMember,
  getStaffBookingAvailabilityForSlot,
  getStaffSchedules,
  getUserById,
  getUserWithServiceIds,
  reactivateStaffProfile,
  resendManagerStaffInvite,
  revokeStaffProfileAccess,
  setStaffSchedules,
  setStaffServiceIds,
  updateStaffMember,
  validateActiveServiceIds,
  type ReactivateStaffProfileResult,
  type StaffAccessRevocationRejectionReason,
} from '@repo/database/staff'
import { isDuplicatePhoneError } from '@repo/database/clients'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { validateAppointmentWindow } from '@repo/salon-core/appointment-time'
import {
  staffCreateRequestSchema,
  staffScheduleRequestSchema,
  staffServiceIdsSchema,
  staffUpdateSchema,
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

const inviteRejectionMessage: Record<
  'inactive_profile' | 'duplicate_pending_invite' | 'duplicate_active_profile',
  string
> = {
  inactive_profile:
    'این پروفایل پرسنل غیرفعال است. ابتدا آن را فعال کنید و بعد دعوت بفرستید.',
  duplicate_pending_invite: 'برای این شماره قبلاً دعوت در انتظار وجود دارد',
  duplicate_active_profile:
    'برای این شماره قبلاً پروفایل پرسنل فعال در این سالن وجود دارد',
}

const accessRevocationMessage: Record<
  StaffAccessRevocationRejectionReason,
  string
> = {
  access_not_found: 'دسترسی پرسنل برای این سالن یافت نشد',
  already_revoked: 'دسترسی این پرسنل قبلاً لغو شده است',
  profile_not_found: 'پروفایل پرسنل یافت نشد',
  wrong_salon: 'این پروفایل متعلق به این سالن نیست',
}

function accessRevocationStatus(
  reason: StaffAccessRevocationRejectionReason,
): 404 | 409 {
  if (reason === 'already_revoked') return 409
  return 404
}

type ReactivateRejectionReason = Extract<
  ReactivateStaffProfileResult,
  { status: 'rejected' }
>['reason']

const reactivateRejectionMessage: Record<ReactivateRejectionReason, string> = {
  already_active: 'این پروفایل پرسنل از قبل فعال است',
  wrong_salon: 'این پروفایل متعلق به این سالن نیست',
  profile_not_found: 'پروفایل پرسنل یافت نشد',
}

function reactivateRejectionStatus(
  reason: ReactivateRejectionReason,
): 404 | 409 {
  if (reason === 'already_active') return 409
  return 404
}

const inviteLifecycleRejectionMessage: Record<
  'invite_not_found' | 'invite_not_pending' | 'inactive_profile',
  string
> = {
  invite_not_found: 'دعوت یافت نشد',
  invite_not_pending: 'این دعوت دیگر در انتظار نیست',
  inactive_profile:
    'این پروفایل پرسنل غیرفعال است. ابتدا آن را فعال کنید و بعد دعوت را دوباره بفرستید.',
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
      const { salonId, userId } = c.var.tenant
      const { name, phone, role } = c.req.valid('json')
      if (role !== 'staff') {
        return error(c, 'دعوت پرسنل فقط برای نقش پرسنل مجاز است', 400)
      }

      const result = await createManagerStaffInvite({
        salonId,
        name,
        phone,
        invitedByUserId: userId,
      })
      if (result.status === 'rejected') {
        return error(
          c,
          inviteRejectionMessage[result.reason],
          409,
          result.reason,
        )
      }

      const staffMember = await getUserWithServiceIds(
        result.profile.id,
        salonId,
      )
      if (!staffMember) {
        return error(c, 'دعوت ایجاد شد اما پروفایل بازخوانی نشد', 500)
      }
      return ok(c, {
        user: staffMember,
        inviteToken: result.inviteToken,
        invite: {
          id: result.invite.id,
          status: result.invite.status,
          expiresAt: result.invite.expiresAt.toISOString(),
          lastDeliveredAt: result.invite.lastDeliveredAt?.toISOString() ?? null,
        },
      })
    },
  )
  .post(
    '/:id/invite/cancel',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const result = await cancelManagerStaffInvite({
        salonId,
        staffProfileId: id,
      })
      if (result.status === 'rejected') {
        const status = result.reason === 'invite_not_found' ? 404 : 409
        return error(
          c,
          inviteLifecycleRejectionMessage[result.reason],
          status,
          result.reason,
        )
      }
      return ok(c, {
        success: true,
        invite: {
          id: result.invite.id,
          status: result.invite.status,
          revokedAt: result.invite.revokedAt?.toISOString() ?? null,
        },
        profile: {
          id: result.profile.id,
          name: result.profile.name,
          active: result.profile.active,
        },
      })
    },
  )
  .post(
    '/:id/invite/resend',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const result = await resendManagerStaffInvite({
        salonId,
        staffProfileId: id,
      })
      if (result.status === 'rejected') {
        const status = result.reason === 'invite_not_found' ? 404 : 409
        return error(
          c,
          inviteLifecycleRejectionMessage[result.reason],
          status,
          result.reason,
        )
      }
      return ok(c, {
        inviteToken: result.inviteToken,
        invite: {
          id: result.invite.id,
          status: result.invite.status,
          expiresAt: result.invite.expiresAt.toISOString(),
          lastDeliveredAt: result.invite.lastDeliveredAt?.toISOString() ?? null,
        },
        profile: {
          id: result.profile.id,
          name: result.profile.name,
        },
      })
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
  .post(
    '/:id/access/revoke',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId, userId } = c.var.tenant
      const { id } = c.req.valid('param')
      if (id === userId) {
        return error(c, 'دسترسی حساب فعلی خودتان را نمی‌توانید لغو کنید.', 400)
      }

      const result = await revokeStaffProfileAccess({
        salonId,
        targetId: id,
      })
      if (result.status === 'rejected') {
        return error(
          c,
          accessRevocationMessage[result.reason],
          accessRevocationStatus(result.reason),
          result.reason,
        )
      }

      return ok(c, {
        success: true,
        access: result.access
          ? {
              id: result.access.id,
              salonId: result.access.salonId,
              staffProfileId: result.access.staffProfileId,
              userId: result.access.userId,
              revokedAt: result.access.revokedAt?.toISOString() ?? null,
            }
          : null,
        profile: {
          id: result.profile.id,
          active: result.profile.active,
          userId: result.profile.userId,
        },
      })
    },
  )
  .post(
    '/:id/reactivate',
    requireTenant('manage_settings'),
    zValidator('param', idParamSchema),
    async (c) => {
      const { salonId } = c.var.tenant
      const { id } = c.req.valid('param')
      const result = await reactivateStaffProfile({
        salonId,
        staffProfileId: id,
      })
      if (result.status === 'rejected') {
        return error(
          c,
          reactivateRejectionMessage[result.reason],
          reactivateRejectionStatus(result.reason),
          result.reason,
        )
      }

      return ok(c, {
        success: true,
        profile: {
          id: result.profile.id,
          active: result.profile.active,
          userId: result.profile.userId,
        },
      })
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
