export const SALON_TIME_ZONE = 'Asia/Tehran'

const HM_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: SALON_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}

/** Gregorian YYYY-MM-DD for the salon's local calendar day. */
export function salonTodayYmd(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: SALON_TIME_ZONE })
}

/** HH:mm in the salon's local time zone. */
export function salonCurrentHm(now: Date = new Date()): string {
  return now.toLocaleTimeString('en-GB', HM_FORMAT_OPTIONS)
}

export function salonHmAfterMinutes(
  minutes: number,
  now: Date = new Date(),
): string {
  return salonCurrentHm(new Date(now.getTime() + minutes * 60 * 1000))
}

/** Add calendar days to a YYYY-MM-DD string using a UTC noon anchor. */
export function addDaysYmd(ymd: string, deltaDays: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  return date.toISOString().slice(0, 10)
}
