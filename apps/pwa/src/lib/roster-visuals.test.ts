import { describe, expect, it } from 'vitest'
import { resolveStaffCalendarColor } from '@repo/salon-core/calendar-colors'
import {
  calendarAccentVar,
  personInitials,
  staffAccentVar,
} from './roster-visuals'

describe('roster visuals', () => {
  it('uses theme color variables for automatic staff accents', () => {
    const staffId = 'staff-1'
    expect(staffAccentVar(staffId)).toBe(
      `var(--calendar-${resolveStaffCalendarColor(staffId)})`,
    )
  })

  it('preserves stored service colors and legacy color values', () => {
    expect(calendarAccentVar('mint')).toBe('var(--calendar-mint)')
    expect(calendarAccentVar('bg-staff-2')).toBe('var(--calendar-violet)')
    expect(calendarAccentVar(null)).toBe('var(--calendar-rose)')
  })

  it('keeps identifying initials when no profile color exists', () => {
    expect(personInitials('سارا احمدی')).toBe('سا')
    expect(personInitials('سارا')).toBe('سا')
    expect(personInitials('')).toBe('؟')
  })
})
