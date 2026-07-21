import { addDaysYmd, salonTodayYmd } from './salon-local-time'

export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'any'
export type FlexibleRequestGroup =
  | 'this-week'
  | 'next-week'
  | 'later'
  | 'elapsed'

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HM_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function isValidYmd(value: string): boolean {
  if (!YMD_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return (
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) ===
    value
  )
}

function saturdayIndex(ymd: string): number {
  return (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 1) % 7
}

export function normalizeAcceptableDates(
  dates: readonly string[],
  today = salonTodayYmd(),
): string[] {
  if (dates.length === 0) throw new Error('acceptable dates are required')
  if (new Set(dates).size !== dates.length) {
    throw new Error('acceptable dates must be unique')
  }
  const maxDate = addDaysYmd(today, 30)
  if (
    dates.some((date) => !isValidYmd(date) || date < today || date > maxDate)
  ) {
    throw new Error('acceptable date is outside the Request Horizon')
  }
  return [...dates].sort()
}

export function nextSalonWeekDates(today = salonTodayYmd()): string[] {
  const nextSaturday = addDaysYmd(today, 7 - saturdayIndex(today))
  return Array.from({ length: 7 }, (_, index) =>
    addDaysYmd(nextSaturday, index),
  )
}

export function isStartTimeInPreference(
  startTime: string,
  preference: TimePreference,
): boolean {
  if (!HM_PATTERN.test(startTime)) return false
  if (preference === 'any') return true
  if (preference === 'morning') return startTime < '12:00'
  if (preference === 'afternoon') {
    return startTime >= '12:00' && startTime < '17:00'
  }
  return startTime >= '17:00'
}

export function flexibleRequestGroup(
  dates: readonly string[],
  today = salonTodayYmd(),
): {
  group: FlexibleRequestGroup
  earliestRemainingDate: string | null
} {
  const earliestRemainingDate = [...dates].sort().find((date) => date >= today)
  if (!earliestRemainingDate) {
    return { group: 'elapsed', earliestRemainingDate: null }
  }

  const thisWeekEnd = addDaysYmd(today, 6 - saturdayIndex(today))
  const nextWeekEnd = addDaysYmd(thisWeekEnd, 7)
  return {
    group:
      earliestRemainingDate <= thisWeekEnd
        ? 'this-week'
        : earliestRemainingDate <= nextWeekEnd
          ? 'next-week'
          : 'later',
    earliestRemainingDate,
  }
}

export function isFlexibleRequestExpired(
  dates: readonly string[],
  now = new Date(),
): boolean {
  const finalDate = [...dates].sort().at(-1)
  return finalDate !== undefined && finalDate < salonTodayYmd(now)
}
