import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import type { BusinessHours, StaffSchedule, User } from '@repo/salon-core/types'
import {
  dayOfWeekFromDate,
  validateStaffAvailability,
  type StaffAvailabilityResult,
} from '@repo/salon-core/staff-availability'
import { getDb } from '../client'
import { member, salonMember, staffSchedules, staffServices, user } from '../schema'
import { rowToStaffSchedule, rowToUser, staffUserSelect } from './row-mappers'
import { getUserById } from './user-queries'
import { getBusinessSettings } from './settings-queries'

export async function getAllStaff(salonId: string): Promise<User[]> {
  const db = getDb()
  const joined = await db
    .select(staffUserSelect)
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .leftJoin(
      salonMember,
      and(eq(salonMember.userId, user.id), eq(salonMember.organizationId, salonId))
    )
    .where(
      and(
        eq(member.organizationId, salonId),
        or(isNull(salonMember.active), eq(salonMember.active, true))
      )
    )
    .orderBy(asc(user.name))
  const rows = joined.map(rowToUser)
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const links = await db
    .select({
      staffUserId: staffServices.staffUserId,
      serviceId: staffServices.serviceId,
    })
    .from(staffServices)
    .where(and(eq(staffServices.salonId, salonId), inArray(staffServices.staffUserId, ids)))

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

/**
 * Returns the only staff user able to perform `serviceId` at `salonId`, or `null`
 * when zero or multiple match. "Able" = restricted (linked) to this service, OR
 * unrestricted (no entries in `staffServices` at all). Used by the Telegram
 * approve-callback to auto-assign when the choice is unambiguous.
 */
export async function findSoleCapableStaffUserId(
  salonId: string,
  serviceId: string
): Promise<string | null> {
  const staff = await getAllStaff(salonId)
  const capable = staff.filter(
    (s) => s.serviceIds == null || s.serviceIds.includes(serviceId)
  )
  return capable.length === 1 ? capable[0]!.id : null
}

export async function staffMayPerformService(
  staffId: string,
  serviceId: string,
  salonId: string
): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .select({ serviceId: staffServices.serviceId })
    .from(staffServices)
    .where(and(eq(staffServices.salonId, salonId), eq(staffServices.staffUserId, staffId)))
  if (rows.length === 0) return true
  return rows.some((r) => r.serviceId === serviceId)
}

export async function getUserWithServiceIds(
  id: string,
  salonId: string
): Promise<User | undefined> {
  const base = await getUserById(id)
  if (!base || base.salonId !== salonId) return undefined
  const db = getDb()
  const links = await db
    .select({ serviceId: staffServices.serviceId })
    .from(staffServices)
    .where(and(eq(staffServices.salonId, salonId), eq(staffServices.staffUserId, id)))
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
  salonId: string
): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .delete(staffServices)
      .where(and(eq(staffServices.salonId, salonId), eq(staffServices.staffUserId, staffUserId)))
    if (serviceIds != null && serviceIds.length > 0) {
      await tx.insert(staffServices).values(
        serviceIds.map((serviceId) => ({
          staffUserId,
          serviceId,
          salonId,
        }))
      )
    }
  })
}

export async function getStaffScheduleForDay(
  salonId: string,
  staffId: string,
  dayOfWeek: number
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
        eq(staffSchedules.active, true)
      )
    )
    .limit(1)
  const row = rows[0]
  return row ? rowToStaffSchedule(row) : undefined
}

export async function getStaffScheduleForDayAnyStatus(
  salonId: string,
  staffId: string,
  dayOfWeek: number
): Promise<StaffSchedule | undefined> {
  const db = getDb()
  const rows = await db
    .select()
    .from(staffSchedules)
    .where(
      and(
        eq(staffSchedules.salonId, salonId),
        eq(staffSchedules.staffId, staffId),
        eq(staffSchedules.dayOfWeek, dayOfWeek)
      )
    )
    .limit(1)
  const row = rows[0]
  return row ? rowToStaffSchedule(row) : undefined
}

export async function getStaffSchedules(
  salonId: string,
  staffId: string
): Promise<StaffSchedule[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(staffSchedules)
    .where(and(eq(staffSchedules.salonId, salonId), eq(staffSchedules.staffId, staffId)))
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
  }>
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
          target: [staffSchedules.salonId, staffSchedules.staffId, staffSchedules.dayOfWeek],
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
  endTime: string
): Promise<StaffAvailabilityResult> {
  const businessHours = await getBusinessSettings(salonId)
  const dayOfWeek = dayOfWeekFromDate(date)
  const schedules = dayOfWeek >= 0 ? await getStaffSchedules(salonId, staffId) : []
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
  endTime: string
): Promise<Array<{ staffId: string; available: boolean; reason?: string }>> {
  const everyone = await getAllStaff(salonId)
  const staffMembers = everyone.filter((u) => u.role === 'staff')
  return Promise.all(
    staffMembers.map(async (u) => {
      const r = await checkStaffAvailabilityForAppointment(salonId, u.id, date, startTime, endTime)
      return {
        staffId: u.id,
        available: r.ok,
        ...(r.ok ? {} : { reason: r.error }),
      }
    })
  )
}

export async function getEffectiveBusinessHours(
  salonId: string,
  options?: { staffId?: string; dayOfWeek?: number }
): Promise<BusinessHours> {
  const salonHours = await getBusinessSettings(salonId)
  if (options?.staffId == null || options.dayOfWeek == null) {
    return salonHours
  }

  const schedule = await getStaffScheduleForDay(salonId, options.staffId, options.dayOfWeek)
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
