import { describe, expect, it } from 'vitest'
import {
  CALENDAR_COLOR_IDS,
  isCalendarColorId,
  normalizeCalendarColorId,
  resolveCalendarColor,
  resolveStaffCalendarColor,
} from './calendar-colors'

describe('calendar color helpers', () => {
  it('recognizes supported calendar color ids', () => {
    expect(isCalendarColorId('rose')).toBe(true)
    expect(isCalendarColorId('bg-staff-1')).toBe(false)
  })

  it('keeps new ids and maps legacy staff color classes', () => {
    expect(normalizeCalendarColorId('mint')).toBe('mint')
    expect(normalizeCalendarColorId('bg-staff-2')).toBe('violet')
    expect(resolveCalendarColor('bg-staff-5')).toBe('coral')
  })

  it('falls back to rose for empty or unknown values', () => {
    expect(normalizeCalendarColorId(null)).toBe('rose')
    expect(normalizeCalendarColorId('something-else')).toBe('rose')
  })

  it('assigns staff ids deterministically from the predefined palette', () => {
    const staffIds = Array.from({ length: 100 }, (_, index) => `staff-${index}`)
    const assigned = staffIds.map(resolveStaffCalendarColor)

    expect(new Set(assigned)).toEqual(new Set(CALENDAR_COLOR_IDS))
    for (const [index, staffId] of staffIds.entries()) {
      expect(resolveStaffCalendarColor(staffId)).toBe(assigned[index])
    }
    expect([...staffIds].reverse().map(resolveStaffCalendarColor)).toEqual(
      [...assigned].reverse(),
    )
  })

  it('keeps known staff assignments stable', () => {
    expect(resolveStaffCalendarColor('staff-1')).toBe('violet')
    expect(resolveStaffCalendarColor('staff-2')).toBe('rose')
    expect(resolveStaffCalendarColor('')).toBe('violet')
  })
})
