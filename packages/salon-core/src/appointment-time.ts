import { addMinutes, differenceInMinutes, format, isValid, parse } from 'date-fns'

const ANCHOR = new Date(2000, 0, 1)
const DEFAULT_TIME = '09:00'

export const APPOINTMENT_DURATION_BOUNDS = { min: 5, max: 12 * 60 } as const

function parseTimeHmLoose(s: string): Date {
  let d = parse(s, 'HH:mm', ANCHOR)
  if (isValid(d)) return d
  d = parse(s, 'HH:mm:ss', ANCHOR)
  if (isValid(d)) return d
  d = parse(s, 'H:mm', ANCHOR)
  if (isValid(d)) return d
  return parse(DEFAULT_TIME, 'HH:mm', ANCHOR)
}

/** Parses HH:mm (and common variants). Never returns an invalid Date. */
export function parseTimeHm(t: string): Date {
  const raw = (t ?? '').trim()
  if (!raw) {
    return parse(DEFAULT_TIME, 'HH:mm', ANCHOR)
  }
  const s = raw.length >= 8 && raw.includes(':') ? raw.slice(0, 5) : raw
  return parseTimeHmLoose(s)
}

export function formatTimeHm(d: Date): string {
  if (!isValid(d)) {
    return DEFAULT_TIME
  }
  return format(d, 'HH:mm')
}

export function endTimeFromDuration(startTime: string, durationMinutes: number): string {
  const start = parseTimeHm(startTime)
  const end = addMinutes(start, Number.isFinite(durationMinutes) ? durationMinutes : 0)
  return formatTimeHm(end)
}

export function durationMinutesFromRange(startTime: string, endTime: string): number {
  const a = parseTimeHm(startTime)
  const b = parseTimeHm(endTime)
  if (!isValid(a) || !isValid(b)) return 0
  return differenceInMinutes(b, a)
}

export function isEndAfterStart(startTime: string, endTime: string): boolean {
  return durationMinutesFromRange(startTime, endTime) > 0
}

export function sameAddonIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((id, index) => id === sortedB[index])
}

export function validateAppointmentWindow(
  startTime: string,
  endTime: string
): { ok: true } | { ok: false; error: string } {
  if (!isEndAfterStart(startTime, endTime)) {
    return { ok: false, error: 'ساعت پایان باید بعد از شروع باشد' }
  }
  const mins = durationMinutesFromRange(startTime, endTime)
  if (mins < APPOINTMENT_DURATION_BOUNDS.min || mins > APPOINTMENT_DURATION_BOUNDS.max) {
    return {
      ok: false,
      error: `مدت نوبت باید بین ${APPOINTMENT_DURATION_BOUNDS.min} و ${APPOINTMENT_DURATION_BOUNDS.max} دقیقه باشد`,
    }
  }
  return { ok: true }
}
