import { describe, expect, it } from 'vitest'
import { isSalonOpenOnDate, validateStaffAvailability, dayOfWeekFromDate } from './staff-availability'
import type { BusinessHours, StaffSchedule } from './types'

const business: BusinessHours = {
  workingStart: '09:00',
  workingEnd: '19:00',
  slotDurationMinutes: 30,
  workingDays: 126,
}

function schedule(
  partial: Partial<StaffSchedule> & Pick<StaffSchedule, 'dayOfWeek' | 'active' | 'workingStart' | 'workingEnd'>
): StaffSchedule {
  return {
    id: '1',
    salonId: 's',
    staffId: 'u',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

describe('validateStaffAvailability', () => {
  it('accepts booking inside staff hours when staff day is active', () => {
    const r = validateStaffAvailability({
      schedule: schedule({ dayOfWeek: 1, active: true, workingStart: '10:00', workingEnd: '18:00' }),
      hasAnyScheduleRows: true,
      businessHours: business,
      startTime: '11:00',
      endTime: '12:00',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.source).toBe('staff')
  })

  it('rejects booking before staff start', () => {
    const r = validateStaffAvailability({
      schedule: schedule({ dayOfWeek: 2, active: true, workingStart: '10:00', workingEnd: '18:00' }),
      hasAnyScheduleRows: true,
      businessHours: business,
      startTime: '09:00',
      endTime: '10:00',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('OUTSIDE_STAFF_HOURS')
  })

  it('rejects booking after staff end', () => {
    const r = validateStaffAvailability({
      schedule: schedule({ dayOfWeek: 3, active: true, workingStart: '10:00', workingEnd: '18:00' }),
      hasAnyScheduleRows: true,
      businessHours: business,
      startTime: '17:30',
      endTime: '18:30',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('OUTSIDE_STAFF_HOURS')
  })

  it('rejects inactive staff day when schedule rows exist', () => {
    const r = validateStaffAvailability({
      schedule: schedule({ dayOfWeek: 4, active: false, workingStart: '10:00', workingEnd: '18:00' }),
      hasAnyScheduleRows: true,
      businessHours: business,
      startTime: '11:00',
      endTime: '12:00',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('STAFF_INACTIVE_DAY')
  })

  it('falls back to business hours when staff has no row for that day but other rows exist', () => {
    const r = validateStaffAvailability({
      schedule: undefined,
      hasAnyScheduleRows: true,
      businessHours: business,
      startTime: '10:00',
      endTime: '11:00',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('STAFF_INACTIVE_DAY')
  })

  it('uses business hours when there are no staff schedule rows at all', () => {
    const r = validateStaffAvailability({
      schedule: undefined,
      hasAnyScheduleRows: false,
      businessHours: business,
      startTime: '10:00',
      endTime: '11:00',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.source).toBe('business')
  })

  it('rejects outside business hours when no staff schedule rows', () => {
    const r = validateStaffAvailability({
      schedule: undefined,
      hasAnyScheduleRows: false,
      businessHours: business,
      startTime: '08:00',
      endTime: '09:00',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('OUTSIDE_BUSINESS_HOURS')
  })
})

describe('dayOfWeekFromDate', () => {
  it('returns UTC weekday index for ISO date string', () => {
    expect(dayOfWeekFromDate('2026-04-20')).toBe(new Date('2026-04-20T00:00:00Z').getUTCDay())
  })
})

describe('isSalonOpenOnDate', () => {
  // 126 = 0b1111110 — Sunday–Friday open, Saturday closed (bit 0 off).
  const defaultMask = 126

  it('returns true for an open salon day', () => {
    // 2026-04-20 is Monday (bit 2).
    expect(isSalonOpenOnDate(defaultMask, '2026-04-20')).toBe(true)
  })

  it('returns false for a closed salon day', () => {
    // 2026-04-18 is Saturday (bit 0).
    expect(isSalonOpenOnDate(defaultMask, '2026-04-18')).toBe(false)
  })

  it('returns false for an invalid date', () => {
    expect(isSalonOpenOnDate(defaultMask, 'not-a-date')).toBe(false)
  })
})
