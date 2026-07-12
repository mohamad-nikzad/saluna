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

/** Converts a Tehran wall-clock date/time to its UTC instant. */
export function salonDateTimeInstant(ymd: string, hm: string): Date {
  const [year, month, day] = ymd.split('-').map(Number)
  const [hour, minute] = hm.split(':').map(Number)
  // Iran has observed permanent UTC+03:30 since 2022.
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 210 * 60_000)
}

export function canEditAppointmentPrice(
  date: string,
  endTime: string,
  now: Date = new Date(),
): boolean {
  const deadline =
    salonDateTimeInstant(date, endTime).getTime() + 24 * 60 * 60_000
  return now.getTime() <= deadline
}
