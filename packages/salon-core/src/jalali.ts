const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

export { JALALI_MONTHS, JALALI_WEEKDAYS_SHORT }

export function toJalali(gy: number, gm: number, gd: number) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = gm > 2 ? gy + 1 : gy
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1]

  let jy = -1595 + 33 * Math.floor(days / 12053)
  days %= 12053

  jy += 4 * Math.floor(days / 1461)
  days %= 1461

  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }

  let jm: number
  let jd: number
  if (days < 186) {
    jm = 1 + Math.floor(days / 31)
    jd = 1 + (days % 31)
  } else {
    jm = 7 + Math.floor((days - 186) / 30)
    jd = 1 + ((days - 186) % 30)
  }

  return { jy, jm, jd }
}

export function toGregorian(jy: number, jm: number, jd: number) {
  const jy2 = jy - 979
  const jd2 = jd - 1

  let jDayNo =
    365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4)
  for (let i = 0; i < jm - 1; i++) jDayNo += i < 6 ? 31 : 30
  jDayNo += jd2

  let gDayNo = jDayNo + 79

  let gy = 1600 + 400 * Math.floor(gDayNo / 146097)
  gDayNo %= 146097

  let leap = true
  if (gDayNo >= 36525) {
    gDayNo--
    gy += 100 * Math.floor(gDayNo / 36524)
    gDayNo %= 36524
    if (gDayNo >= 365) gDayNo++
    else leap = false
  }

  gy += 4 * Math.floor(gDayNo / 1461)
  gDayNo %= 1461

  if (gDayNo >= 366) {
    leap = false
    gDayNo--
    gy += Math.floor(gDayNo / 365)
    gDayNo %= 365
  }

  const gDaysInMonth = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  let gm = 0
  for (let i = 0; i < 12 && gDayNo >= gDaysInMonth[i]; i++) {
    gDayNo -= gDaysInMonth[i]
    gm++
  }

  return { gy, gm: gm + 1, gd: gDayNo + 1 }
}

export function isJalaliLeap(jy: number): boolean {
  const rem = ((((jy - 474) % 2820) + 2820) % 2820) + 474
  return ((rem + 38) * 682) % 2816 < 682
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isJalaliLeap(jy) ? 30 : 29
}

/** Gregorian "yyyy-MM-dd" → { jy, jm, jd } */
export function parseGregorianToJalali(dateStr: string) {
  const [gy, gm, gd] = dateStr.split('-').map(Number)
  return toJalali(gy, gm, gd)
}

/** Jalali date parts → Gregorian "yyyy-MM-dd" */
export function jalaliToGregorianStr(
  jy: number,
  jm: number,
  jd: number,
): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd)
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`
}

/** Format Gregorian "yyyy-MM-dd" as Jalali display string: "۲۶ فروردین ۱۴۰۴" */
export function formatJalaliDate(dateStr: string): string {
  const { jy, jm, jd } = parseGregorianToJalali(dateStr)
  const numFmt = new Intl.NumberFormat('fa-IR')
  return `${numFmt.format(jd)} ${JALALI_MONTHS[jm - 1]} ${numFmt.format(jy)}`
}

/** Format Gregorian "yyyy-MM-dd" as full Jalali with weekday: "شنبه، ۲۶ فروردین ۱۴۰۴" */
export function formatJalaliFullDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const weekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(
    date,
  )
  const jalali = formatJalaliDate(dateStr)
  return `${weekday}، ${jalali}`
}

/**
 * Get the day-of-week (Saturday=0 … Friday=6) for the first day of a Jalali month.
 * Iran week starts on Saturday.
 */
export function jalaliMonthStartDow(jy: number, jm: number): number {
  const { gy, gm, gd } = toGregorian(jy, jm, 1)
  const d = new Date(gy, gm - 1, gd)
  // JS getDay(): 0=Sun … 6=Sat. Convert to Sat=0 … Fri=6
  return (d.getDay() + 1) % 7
}
