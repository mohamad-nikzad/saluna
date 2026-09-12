import { toGregorian, toJalali } from '@repo/salon-core/jalali'

/** Local date boundaries for a Jalali month, with an exclusive end. */
export function calendarMonthRange(date: Date, offset = 0) {
  const { jy, jm } = toJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  )
  const monthStart = (shift: number) => {
    const index = jm - 1 + shift
    const year = jy + Math.floor(index / 12)
    const month = (((index % 12) + 12) % 12) + 1
    const { gy, gm, gd } = toGregorian(year, month, 1)
    return new Date(gy, gm - 1, gd)
  }
  return { start: monthStart(offset), end: monthStart(offset + 1) }
}
