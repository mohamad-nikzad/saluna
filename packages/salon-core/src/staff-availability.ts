import type { BusinessHours, StaffSchedule } from './types'

export const STAFF_AVAILABILITY_CODES = {
  OUTSIDE_STAFF_HOURS: 'OUTSIDE_STAFF_HOURS',
  STAFF_INACTIVE_DAY: 'STAFF_INACTIVE_DAY',
  OUTSIDE_BUSINESS_HOURS: 'OUTSIDE_BUSINESS_HOURS',
} as const

export type StaffAvailabilityCode =
  (typeof STAFF_AVAILABILITY_CODES)[keyof typeof STAFF_AVAILABILITY_CODES]

export type StaffAvailabilityResult =
  | { ok: true; source: 'staff' | 'business'; hours: BusinessHours }
  | {
      ok: false
      code: StaffAvailabilityCode
      error: string
      source: 'staff' | 'business'
      hours: BusinessHours
    }

export type StaffWorkingHoursResult =
  | { ok: true; source: 'staff' | 'business'; hours: BusinessHours }
  | {
      ok: false
      code: typeof STAFF_AVAILABILITY_CODES.STAFF_INACTIVE_DAY
      error: string
      source: 'staff' | 'business'
      hours: BusinessHours
    }

export function dayOfWeekFromDate(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return -1
  return parsed.getUTCDay()
}

/** Maps JS `getUTCDay()` (0=Sun … 6=Sat) to working-days bit index (0=Sat … 6=Fri). */
function workingDayBitIndexFromDate(date: string): number {
  const jsDay = dayOfWeekFromDate(date)
  if (jsDay < 0) return -1
  return (jsDay + 1) % 7
}

export function isSalonOpenOnDate(workingDays: number, date: string): boolean {
  const bitIndex = workingDayBitIndexFromDate(date)
  if (bitIndex < 0) return false
  return (workingDays & (1 << bitIndex)) !== 0
}

export function validateAgainstHours(
  startTime: string,
  endTime: string,
  hours: Pick<BusinessHours, 'workingStart' | 'workingEnd'>,
): boolean {
  return startTime >= hours.workingStart && endTime <= hours.workingEnd
}

export function resolveStaffWorkingHoursForDay(params: {
  schedule: StaffSchedule | undefined
  hasAnyScheduleRows: boolean
  businessHours: BusinessHours
}): StaffWorkingHoursResult {
  const { schedule, hasAnyScheduleRows, businessHours } = params

  if (schedule) {
    const hours = {
      workingStart: schedule.workingStart,
      workingEnd: schedule.workingEnd,
      slotDurationMinutes: businessHours.slotDurationMinutes,
      workingDays: businessHours.workingDays,
    }

    if (!schedule.active) {
      return {
        ok: false,
        code: STAFF_AVAILABILITY_CODES.STAFF_INACTIVE_DAY,
        error: 'پرسنل انتخاب‌شده در این روز فعال نیست.',
        source: 'staff',
        hours,
      }
    }

    return { ok: true, source: 'staff', hours }
  }

  if (hasAnyScheduleRows) {
    return {
      ok: false,
      code: STAFF_AVAILABILITY_CODES.STAFF_INACTIVE_DAY,
      error: 'برای این روز برنامه کاری فعالی برای پرسنل ثبت نشده است.',
      source: 'staff',
      hours: businessHours,
    }
  }

  return { ok: true, source: 'business', hours: businessHours }
}

export function validateStaffAvailability(params: {
  schedule: StaffSchedule | undefined
  hasAnyScheduleRows: boolean
  businessHours: BusinessHours
  startTime: string
  endTime: string
}): StaffAvailabilityResult {
  const { businessHours, startTime, endTime } = params
  const resolved = resolveStaffWorkingHoursForDay(params)

  if (!resolved.ok) {
    return resolved
  }

  if (
    resolved.source === 'staff' &&
    !validateAgainstHours(startTime, endTime, resolved.hours)
  ) {
    return {
      ok: false,
      code: STAFF_AVAILABILITY_CODES.OUTSIDE_STAFF_HOURS,
      error: `این نوبت خارج از برنامه کاری پرسنل (${resolved.hours.workingStart} تا ${resolved.hours.workingEnd}) است.`,
      source: 'staff',
      hours: resolved.hours,
    }
  }

  if (
    resolved.source === 'business' &&
    !validateAgainstHours(startTime, endTime, resolved.hours)
  ) {
    return {
      ok: false,
      code: STAFF_AVAILABILITY_CODES.OUTSIDE_BUSINESS_HOURS,
      error: `این نوبت خارج از ساعت کاری سالن (${businessHours.workingStart} تا ${businessHours.workingEnd}) است.`,
      source: 'business',
      hours: resolved.hours,
    }
  }

  return resolved
}
