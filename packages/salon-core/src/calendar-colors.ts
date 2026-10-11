export type CalendarColorId = 'rose' | 'violet' | 'mint' | 'gold' | 'coral'

export const CALENDAR_COLOR_IDS = [
  'rose',
  'violet',
  'mint',
  'gold',
  'coral',
] as const

export const LEGACY_CALENDAR_COLOR_MAP: Record<string, CalendarColorId> = {
  'bg-staff-1': 'rose',
  'bg-staff-2': 'violet',
  'bg-staff-3': 'mint',
  'bg-staff-4': 'gold',
  'bg-staff-5': 'coral',
} as const

const calendarColorIdSet = new Set<string>(CALENDAR_COLOR_IDS)

export function isCalendarColorId(value: string): value is CalendarColorId {
  return calendarColorIdSet.has(value)
}

export function normalizeCalendarColorId(
  value: string | null | undefined,
): CalendarColorId {
  if (!value) return 'rose'
  if (isCalendarColorId(value)) return value
  return LEGACY_CALENDAR_COLOR_MAP[value] ?? 'rose'
}

export function resolveCalendarColor(
  value: string | null | undefined,
): CalendarColorId {
  return normalizeCalendarColorId(value)
}

/** Stable across profile edits and roster changes; no color is stored on staff. */
export function resolveStaffCalendarColor(staffId: string): CalendarColorId {
  let hash = 2166136261
  for (let index = 0; index < staffId.length; index += 1) {
    hash = Math.imul(hash ^ staffId.charCodeAt(index), 16777619)
  }
  return CALENDAR_COLOR_IDS[(hash >>> 0) % CALENDAR_COLOR_IDS.length]
}
