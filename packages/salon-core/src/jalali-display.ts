/**
 * Jalali (شمسی) labels using ICU Persian calendar — matches user-facing dates in Iran.
 * Falls back to fa-IR Gregorian if the runtime does not support u-ca-persian.
 */

const PRIMARY_LOCALE = 'fa-IR-u-ca-persian'
const FALLBACK_LOCALE = 'fa-IR'

function safeFormat(date: Date, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(PRIMARY_LOCALE, options).format(date)
  } catch {
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, options).format(date)
  }
}

/** Day column header (week / time-grid): e.g. شنبه ۲ فروردین */
export function formatPersianDayHeader(date: Date): string {
  return safeFormat(date, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Compact day header for narrow columns: weekday abbreviation + day number on separate lines */
export function formatPersianDayHeaderCompact(date: Date): {
  weekday: string
  day: string
} {
  return {
    weekday: safeFormat(date, { weekday: 'short' }),
    day: safeFormat(date, { day: 'numeric' }),
  }
}

/** Numeric day inside month grid */
export function formatPersianDayNumber(date: Date): string {
  return safeFormat(date, { day: 'numeric' })
}

/** Month + year line (month view popover / titles) */
export function formatPersianMonthYear(date: Date): string {
  return safeFormat(date, { month: 'long', year: 'numeric' })
}

/** Single day title */
export function formatPersianFullDate(date: Date): string {
  return safeFormat(date, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Week range title */
export function formatPersianWeekRange(weekStart: Date, weekEnd: Date): string {
  const a = safeFormat(weekStart, { day: 'numeric', month: 'long' })
  const b = safeFormat(weekEnd, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${a} تا ${b}`
}

/** Time labels (۲۴ ساعته، ارقام فارسی) */
export function formatPersianTimeHm(date: Date): string {
  return safeFormat(date, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** List view day heading */
export function formatPersianListDay(date: Date): string {
  return safeFormat(date, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Saturday-anchored start of week (Persian calendar weeks begin Saturday). */
function startOfSaturdayWeek(d: Date): Date {
  const dow = (d.getDay() + 1) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
}

/** List view day heading with relative prefix (امروز / فردا / پس‌فردا / هفته بعد …) */
export function formatPersianListDayRelative(
  date: Date,
  today: Date = new Date(),
): string {
  const base = formatPersianListDay(date)
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((day.getTime() - ref.getTime()) / 86_400_000)
  if (diff === 0) return `امروز · ${base}`
  if (diff === 1) return `فردا · ${base}`
  if (diff === 2) return `پس‌فردا · ${base}`
  if (diff === -1) return `دیروز · ${base}`
  if (diff > 2) {
    const weekDiff = Math.round(
      (startOfSaturdayWeek(day).getTime() -
        startOfSaturdayWeek(ref).getTime()) /
        (7 * 86_400_000),
    )
    if (weekDiff === 1) return `هفته بعد · ${base}`
    if (weekDiff === 2) return `دو هفته بعد · ${base}`
  }
  return base
}

/** FullCalendar VerboseFormattingArg / ExpandedZonedMarker → local Date (wall time) */
export function expandedZonedToDate(z: {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
  millisecond?: number
}): Date {
  return new Date(
    z.year,
    z.month - 1,
    z.day,
    z.hour ?? 0,
    z.minute ?? 0,
    z.second ?? 0,
    z.millisecond ?? 0,
  )
}
