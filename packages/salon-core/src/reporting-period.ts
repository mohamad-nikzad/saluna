import {
  jalaliMonthLength,
  jalaliToGregorianStr,
  parseGregorianToJalali,
} from './jalali'
import { addDaysYmd, salonTodayYmd } from './salon-local-time'

export type ReportingPeriod = 'today' | 'week' | 'month' | 'custom'

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validYmd(value: string | undefined): value is string {
  if (!value || !YMD_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.toISOString().slice(0, 10) === value
}

export function reportingPeriodRange(input: {
  period: ReportingPeriod
  startDate?: string
  endDate?: string
  now?: Date
}): { startDate: string; endDate: string } {
  const today = salonTodayYmd(input.now)
  if (input.period === 'today') return { startDate: today, endDate: today }

  if (input.period === 'week') {
    const day = new Date(`${today}T12:00:00Z`).getUTCDay()
    const startDate = addDaysYmd(today, -((day + 1) % 7))
    return { startDate, endDate: addDaysYmd(startDate, 6) }
  }

  if (input.period === 'month') {
    const { jy, jm } = parseGregorianToJalali(today)
    return {
      startDate: jalaliToGregorianStr(jy, jm, 1),
      endDate: jalaliToGregorianStr(jy, jm, jalaliMonthLength(jy, jm)),
    }
  }

  if (
    !validYmd(input.startDate) ||
    !validYmd(input.endDate) ||
    input.startDate > input.endDate
  ) {
    throw new Error('custom period requires a valid inclusive date range')
  }
  return { startDate: input.startDate, endDate: input.endDate }
}
