import { and, asc, count, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import type {
  BusinessHours,
  StaffSchedule,
  User,
  UserRole,
} from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import {
  dayOfWeekFromDate,
  validateStaffAvailability,
  type StaffAvailabilityResult,
} from '@repo/salon-core/staff-availability'
import { getDb } from '../client'
import {
  account,
  member,
  salonMember,
  staffInvites,
  staffProfiles,
  staffSchedules,
  staffServices,
  user,
} from '../schema'
import { rowToStaffSchedule, rowToUser, staffUserSelect } from './row-mappers'
import { getBusinessSettings } from './settings-queries'
import { hashCredentialPassword } from '../auth-password'

export type UpdateStaffInput = {
  name: string
  nickname: string | null
  phone: string
  role: UserRole
  color: string
}

export async function getAllStaff(salonId: string): Promise<User[]> {
  const db = getDb()
  const joined = await db
    .select(staffUserSelect)
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .leftJoin(
      salonMember,
      and(
        eq(salonMember.userId, user.id),
        eq(salonMember.organizationId, salonId),
      ),
    )
    .where(
      and(
        eq(member.organizationId, salonId),
        or(isNull(salonMember.active), eq(salonMember.active, true)),
      ),
    )
    .orderBy(asc(user.name))
  const legacyRows = joined.map(rowToUser)
  const preparedProfiles = (
    await db
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.salonId, salonId))
      .orderBy(asc(staffProfiles.name))
  ).filter((row) => row.active && row.userId === null)

  const pendingInviteProfileIds = new Set(
    preparedProfiles.length === 0
      ? []
      : (
          await db
            .select({ staffProfileId: staffInvites.staffProfileId })
            .from(staffInvites)
            .where(
              and(
                eq(staffInvites.salonId, salonId),
                eq(staffInvites.status, 'pending'),
                inArray(
                  staffInvites.staffProfileId,
                  preparedProfiles.map((row) => row.id),
                ),
              ),
            )
        ).map((row) => row.staffProfileId),
  )

  const preparedRows: User[] = preparedProfiles.map((row) => ({
    id: row.id,
    salonId: row.salonId,
    name: row.name,
    fullName: row.name,
    nickname: null,
    phone: row.phone,
    role: 'staff' as const,
    color: row.color,
    createdAt: row.createdAt,
    inviteStatus: pendingInviteProfileIds.has(row.id) ? ('pending' as const) : null,
  }))
  const rows = [...legacyRows, ...preparedRows].sort((a, b) =>
    a.name.localeCompare(b.name, 'fa'),
  )
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const links = await db
    .select({
      staffUserId: staffServices.staffUserId,
      serviceId: staffServices.serviceId,
    })
    .from(staffServices)
    .where(
      and(
        eq(staffServices.salonId, salonId),
        inArray(staffServices.staffUserId, ids),
      ),
    )

  const byUser = new Map<string, string[]>()
  for (const row of links) {
    const cur = byUser.get(row.staffUserId) ?? []
    cur.push(row.serviceId)
    byUser.set(row.staffUserId, cur)
  }

  return rows.map((base) => {
    const assigned = byUser.get(base.id)
    if (assigned === undefined) {
      return { ...base, serviceIds: null as string[] | null }
    }
    const unique = [...new Set(assigned)].sort()
    return { ...base, serviceIds: unique }
  })
}

function emailForUpdatedPhone(currentEmail: string, phone: string): string {
  const domain = currentEmail.split('@')[1]?.trim()
  return domain ? `${phone}@${domain}` : currentEmail
}

export async function updateStaffMember(
  salonId: string,
  staffUserId: string,
  input: UpdateStaffInput,
): Promise<User | undefined> {
  const db = getDb()
  const rows = await db
    .select({
      userId: user.id,
      email: user.email,
      memberRole: member.role,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(member.organizationId, salonId), eq(member.userId, staffUserId)),
    )
    .limit(1)

  const existing = rows[0]
  if (!existing) return undefined

  const nextRole =
    input.role === 'manager'
      ? existing.memberRole === 'owner'
        ? 'owner'
        : 'admin'
      : 'member'
  const displayName = input.nickname
  const color = normalizeCalendarColorId(input.color)

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name: input.name,
        username: input.phone,
        displayUsername: input.phone,
        phoneNumber: input.phone,
        phoneNumberVerified: true,
        email: emailForUpdatedPhone(existing.email, input.phone),
        updatedAt: new Date(),
      })
      .where(eq(user.id, staffUserId))

    await tx
      .update(member)
      .set({ role: nextRole })
      .where(
        and(eq(member.organizationId, salonId), eq(member.userId, staffUserId)),
      )

    await tx
      .insert(salonMember)
      .values({
        userId: staffUserId,
        organizationId: salonId,
        displayName,
        color,
        active: true,
      })
      .onConflictDoUpdate({
        target: [salonMember.userId, salonMember.organizationId],
        set: { displayName, color, active: true },
      })
  })

  return getUserWithServiceIds(staffUserId, salonId)
}

export async function deactivateStaffMember(
  salonId: string,
  staffUserId: string,
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(eq(member.organizationId, salonId), eq(member.userId, staffUserId)),
    )
    .limit(1)

  if (!rows[0]) return false

  await db.transaction(async (tx) => {
    await tx
      .insert(salonMember)
      .values({
        userId: staffUserId,
        organizationId: salonId,
        active: false,
      })
      .onConflictDoUpdate({
        target: [salonMember.userId, salonMember.organizationId],
        set: { active: false },
      })

    await tx
      .delete(staffServices)
      .where(
        and(
          eq(staffServices.salonId, salonId),
          eq(staffServices.staffUserId, staffUserId),
        ),
      )
  })

  return true
}

export async function updateStaffPassword(
  salonId: string,
  staffUserId: string,
  password: string,
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(eq(member.organizationId, salonId), eq(member.userId, staffUserId)),
    )
    .limit(1)

  if (!rows[0]) return false

  const passwordHash = await hashCredentialPassword(password)
  const updated = await db
    .update(account)
    .set({ password: passwordHash, updatedAt: new Date() })
    .where(
      and(
        eq(account.userId, staffUserId),
        eq(account.providerId, 'credential'),
      ),
    )
    .returning({ id: account.id })

  if (updated.length > 0) return true

  await db.insert(account).values({
    userId: staffUserId,
    accountId: staffUserId,
    providerId: 'credential',
    password: passwordHash,
  })

  return true
}

export async function countManagers(salonId: string): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ value: count() })
    .from(member)
    .leftJoin(
      salonMember,
      and(
        eq(salonMember.userId, member.userId),
        eq(salonMember.organizationId, salonId),
      ),
    )
    .where(
      and(
        eq(member.organizationId, salonId),
        inArray(member.role, ['owner', 'admin']),
        or(isNull(salonMember.active), ne(salonMember.active, false)),
      ),
    )
  return Number(rows[0]?.value ?? 0)
}

/**
 * Returns the only staff user able to perform `serviceId` at `salonId`, or `null`
 * when zero or multiple match. "Able" = restricted (linked) to this service, OR
 * unrestricted (no entries in `staffServices` at all). Used by the Telegram
 * approve-callback to auto-assign when the choice is unambiguous.
 */
export async function findSoleCapableStaffUserId(
  salonId: string,
  serviceId: string,
): Promise<string | null> {
  const staff = await getAllStaff(salonId)
  const capable = staff.filter(
    (s) => s.serviceIds == null || s.serviceIds.includes(serviceId),
  )
  return capable.length === 1 ? capable[0]!.id : null
}

export async function listCapableStaffForService(
  salonId: string,
  serviceId: string,
): Promise<{ id: string; name: string }[]> {
  const staff = await getAllStaff(salonId)
  return staff
    .filter((s) => s.serviceIds == null || s.serviceIds.includes(serviceId))
    .map((s) => ({ id: s.id, name: s.name }))
}

export async function staffMayPerformService(
  staffId: string,
  serviceId: string,
  salonId: string,
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ serviceId: staffServices.serviceId })
    .from(staffServices)
    .where(
      and(
        eq(staffServices.salonId, salonId),
        eq(staffServices.staffUserId, staffId),
      ),
    )
  if (rows.length === 0) return true
  return rows.some((r) => r.serviceId === serviceId)
}

export async function getUserWithServiceIds(
  id: string,
  salonId: string,
): Promise<User | undefined> {
  const db = getDb()
  const rows = await db
    .select(staffUserSelect)
    .from(user)
    .innerJoin(
      member,
      and(eq(member.userId, user.id), eq(member.organizationId, salonId)),
    )
    .leftJoin(
      salonMember,
      and(
        eq(salonMember.userId, user.id),
        eq(salonMember.organizationId, salonId),
      ),
    )
    .where(
      and(
        eq(user.id, id),
        or(isNull(salonMember.active), eq(salonMember.active, true)),
      ),
    )
    .limit(1)
  const base = rows[0] ? rowToUser(rows[0]) : undefined
  if (!base) return undefined
  const links = await db
    .select({ serviceId: staffServices.serviceId })
    .from(staffServices)
    .where(
      and(
        eq(staffServices.salonId, salonId),
        eq(staffServices.staffUserId, base.id),
      ),
    )
  if (links.length === 0) {
    return { ...base, serviceIds: null as string[] | null }
  }
  const unique = [...new Set(links.map((r) => r.serviceId))].sort()
  return { ...base, serviceIds: unique }
}

/** `null` or empty after delete = unrestricted (همه خدمات فعال). */
export async function setStaffServiceIds(
  staffUserId: string,
  serviceIds: string[] | null,
  salonId: string,
): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .delete(staffServices)
      .where(
        and(
          eq(staffServices.salonId, salonId),
          eq(staffServices.staffUserId, staffUserId),
        ),
      )
    if (serviceIds != null && serviceIds.length > 0) {
      await tx.insert(staffServices).values(
        serviceIds.map((serviceId) => ({
          staffUserId,
          serviceId,
          salonId,
        })),
      )
    }
  })
}

export async function getStaffScheduleForDay(
  salonId: string,
  staffId: string,
  dayOfWeek: number,
): Promise<StaffSchedule | undefined> {
  const db = getDb()
  const rows = await db
    .select()
    .from(staffSchedules)
    .where(
      and(
        eq(staffSchedules.salonId, salonId),
        eq(staffSchedules.staffId, staffId),
        eq(staffSchedules.dayOfWeek, dayOfWeek),
        eq(staffSchedules.active, true),
      ),
    )
    .limit(1)
  const row = rows[0]
  return row ? rowToStaffSchedule(row) : undefined
}

export async function getStaffScheduleForDayAnyStatus(
  salonId: string,
  staffId: string,
  dayOfWeek: number,
): Promise<StaffSchedule | undefined> {
  const db = getDb()
  const rows = await db
    .select()
    .from(staffSchedules)
    .where(
      and(
        eq(staffSchedules.salonId, salonId),
        eq(staffSchedules.staffId, staffId),
        eq(staffSchedules.dayOfWeek, dayOfWeek),
      ),
    )
    .limit(1)
  const row = rows[0]
  return row ? rowToStaffSchedule(row) : undefined
}

export async function getStaffSchedules(
  salonId: string,
  staffId: string,
): Promise<StaffSchedule[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(staffSchedules)
    .where(
      and(
        eq(staffSchedules.salonId, salonId),
        eq(staffSchedules.staffId, staffId),
      ),
    )
    .orderBy(asc(staffSchedules.dayOfWeek))
  return rows.map(rowToStaffSchedule)
}

export async function setStaffSchedules(
  salonId: string,
  staffId: string,
  schedule: Array<{
    dayOfWeek: number
    active: boolean
    workingStart: string
    workingEnd: string
  }>,
): Promise<StaffSchedule[]> {
  const db = getDb()
  await db.transaction(async (tx) => {
    for (const row of schedule) {
      await tx
        .insert(staffSchedules)
        .values({
          salonId,
          staffId,
          dayOfWeek: row.dayOfWeek,
          active: row.active,
          workingStart: row.workingStart,
          workingEnd: row.workingEnd,
        })
        .onConflictDoUpdate({
          target: [
            staffSchedules.salonId,
            staffSchedules.staffId,
            staffSchedules.dayOfWeek,
          ],
          set: {
            active: row.active,
            workingStart: row.workingStart,
            workingEnd: row.workingEnd,
            updatedAt: new Date(),
          },
        })
    }
  })

  return getStaffSchedules(salonId, staffId)
}

export async function checkStaffAvailabilityForAppointment(
  salonId: string,
  staffId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<StaffAvailabilityResult> {
  const businessHours = await getBusinessSettings(salonId)
  const dayOfWeek = dayOfWeekFromDate(date)
  const schedules =
    dayOfWeek >= 0 ? await getStaffSchedules(salonId, staffId) : []
  const schedule = schedules.find((row) => row.dayOfWeek === dayOfWeek)

  return validateStaffAvailability({
    schedule,
    hasAnyScheduleRows: schedules.length > 0,
    businessHours,
    startTime,
    endTime,
  })
}

export async function getStaffBookingAvailabilityForSlot(
  salonId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<Array<{ staffId: string; available: boolean; reason?: string }>> {
  const everyone = await getAllStaff(salonId)
  const staffMembers = everyone.filter((u) => u.role === 'staff')
  return Promise.all(
    staffMembers.map(async (u) => {
      const r = await checkStaffAvailabilityForAppointment(
        salonId,
        u.id,
        date,
        startTime,
        endTime,
      )
      return {
        staffId: u.id,
        available: r.ok,
        ...(r.ok ? {} : { reason: r.error }),
      }
    }),
  )
}

export async function getEffectiveBusinessHours(
  salonId: string,
  options?: { staffId?: string; dayOfWeek?: number },
): Promise<BusinessHours> {
  const salonHours = await getBusinessSettings(salonId)
  if (options?.staffId == null || options.dayOfWeek == null) {
    return salonHours
  }

  const schedule = await getStaffScheduleForDay(
    salonId,
    options.staffId,
    options.dayOfWeek,
  )
  if (!schedule) {
    return salonHours
  }

  return {
    workingStart: schedule.workingStart,
    workingEnd: schedule.workingEnd,
    slotDurationMinutes: salonHours.slotDurationMinutes,
    workingDays: salonHours.workingDays,
  }
}
