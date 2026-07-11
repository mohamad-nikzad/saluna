import { describe, expect, it } from 'vitest'
import {
  AVAILABILITY_EMPTY_REASONS,
  getAvailabilityForDay,
  getNearestAvailability,
  type AvailabilityStaffDay,
} from './availability'

function staffDay(
  partial: Partial<AvailabilityStaffDay> &
    Pick<AvailabilityStaffDay, 'staffId' | 'staffName'>,
): AvailabilityStaffDay {
  return {
    staffId: partial.staffId,
    staffName: partial.staffName,
    workingHours:
      partial.workingHours === undefined
        ? {
            workingStart: '09:00',
            workingEnd: '18:00',
          }
        : partial.workingHours,
    appointments: partial.appointments ?? [],
  }
}

describe('getAvailabilityForDay', () => {
  it('returns grid-aligned slots for a specific working staff member', () => {
    const result = getAvailabilityForDay({
      date: '2026-05-05',
      staffDays: [
        staffDay({
          staffId: 'sara',
          staffName: 'سارا',
          appointments: [
            { startTime: '10:00', endTime: '10:30', status: 'scheduled' },
            { startTime: '12:00', endTime: '13:00', status: 'confirmed' },
          ],
        }),
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'specific',
    })

    expect(result).toEqual({
      slots: [
        {
          date: '2026-05-05',
          startTime: '09:00',
          endTime: '10:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '10:30',
          endTime: '11:30',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '11:00',
          endTime: '12:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '13:00',
          endTime: '14:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '13:30',
          endTime: '14:30',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '14:00',
          endTime: '15:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '14:30',
          endTime: '15:30',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '15:00',
          endTime: '16:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '15:30',
          endTime: '16:30',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '16:00',
          endTime: '17:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '16:30',
          endTime: '17:30',
          staffId: 'sara',
          staffName: 'سارا',
        },
        {
          date: '2026-05-05',
          startTime: '17:00',
          endTime: '18:00',
          staffId: 'sara',
          staffName: 'سارا',
        },
      ],
    })
  })

  it('reports a specific staff off day when no working window exists', () => {
    const result = getAvailabilityForDay({
      date: '2026-05-05',
      staffDays: [
        staffDay({
          staffId: 'sara',
          staffName: 'سارا',
          workingHours: null,
        }),
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'specific',
    })

    expect(result).toEqual({
      slots: [],
      emptyReason: AVAILABILITY_EMPTY_REASONS.STAFF_OFF_DAY,
    })
  })

  it('reports all-qualified-staff-off-day when every eligible person is off', () => {
    const result = getAvailabilityForDay({
      date: '2026-05-05',
      staffDays: [
        staffDay({ staffId: 'sara', staffName: 'سارا', workingHours: null }),
        staffDay({ staffId: 'mina', staffName: 'مینا', workingHours: null }),
      ],
      serviceDurationMinutes: 45,
      slotDurationMinutes: 15,
      searchMode: 'any',
    })

    expect(result).toEqual({
      slots: [],
      emptyReason: AVAILABILITY_EMPTY_REASONS.ALL_QUALIFIED_STAFF_OFF_DAY,
    })
  })

  it('returns fully booked when staff are working but no slot fits', () => {
    const result = getAvailabilityForDay({
      date: '2026-05-05',
      staffDays: [
        staffDay({
          staffId: 'sara',
          staffName: 'سارا',
          appointments: [
            { startTime: '09:00', endTime: '12:00', status: 'scheduled' },
            { startTime: '12:30', endTime: '18:00', status: 'confirmed' },
          ],
        }),
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'specific',
    })

    expect(result).toEqual({
      slots: [],
      emptyReason: AVAILABILITY_EMPTY_REASONS.FULLY_BOOKED,
    })
  })

  it('rounds today searches up to the next valid slot boundary', () => {
    const result = getAvailabilityForDay({
      date: '2026-05-05',
      todayDate: '2026-05-05',
      nowTime: '09:10',
      staffDays: [
        staffDay({
          staffId: 'sara',
          staffName: 'سارا',
          workingHours: {
            workingStart: '09:00',
            workingEnd: '11:00',
          },
        }),
      ],
      serviceDurationMinutes: 30,
      slotDurationMinutes: 30,
      searchMode: 'specific',
    })

    expect(result.slots.map((slot) => slot.startTime)).toEqual([
      '09:30',
      '10:00',
      '10:30',
    ])
  })

  it('keeps only slot boundaries where the full service fits', () => {
    const result = getAvailabilityForDay({
      date: '2026-05-05',
      staffDays: [
        staffDay({
          staffId: 'sara',
          staffName: 'سارا',
          workingHours: {
            workingStart: '09:10',
            workingEnd: '10:40',
          },
        }),
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'specific',
    })

    expect(result.slots.map((slot) => slot.startTime)).toEqual(['09:30'])
  })
})

describe('getNearestAvailability', () => {
  it('finds the nearest slot later on the same day', () => {
    const result = getNearestAvailability({
      days: [
        {
          date: '2026-05-05',
          staffDays: [
            staffDay({
              staffId: 'sara',
              staffName: 'سارا',
              workingHours: {
                workingStart: '09:00',
                workingEnd: '14:00',
              },
              appointments: [
                { startTime: '09:00', endTime: '11:30', status: 'scheduled' },
              ],
            }),
            staffDay({
              staffId: 'mina',
              staffName: 'مینا',
              workingHours: {
                workingStart: '09:00',
                workingEnd: '15:00',
              },
              appointments: [
                { startTime: '09:00', endTime: '12:00', status: 'confirmed' },
              ],
            }),
          ],
        },
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'any',
      todayDate: '2026-05-05',
      nowTime: '10:10',
    })

    expect(result).toEqual({
      slot: {
        date: '2026-05-05',
        startTime: '11:30',
        endTime: '12:30',
        staffId: 'sara',
        staffName: 'سارا',
      },
    })
  })

  it('falls forward to a later day when the selected day has no openings', () => {
    const result = getNearestAvailability({
      days: [
        {
          date: '2026-05-05',
          staffDays: [
            staffDay({
              staffId: 'sara',
              staffName: 'سارا',
              workingHours: null,
            }),
          ],
        },
        {
          date: '2026-05-06',
          staffDays: [
            staffDay({
              staffId: 'sara',
              staffName: 'سارا',
              workingHours: {
                workingStart: '10:00',
                workingEnd: '13:00',
              },
            }),
          ],
        },
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'specific',
      todayDate: '2026-05-05',
      nowTime: '09:00',
    })

    expect(result).toEqual({
      slot: {
        date: '2026-05-06',
        startTime: '10:00',
        endTime: '11:00',
        staffId: 'sara',
        staffName: 'سارا',
      },
    })
  })

  it('returns outside-search-window when nothing is available in the search days', () => {
    const result = getNearestAvailability({
      days: [
        {
          date: '2026-05-05',
          staffDays: [
            staffDay({
              staffId: 'sara',
              staffName: 'سارا',
              workingHours: null,
            }),
          ],
        },
        {
          date: '2026-05-06',
          staffDays: [
            staffDay({
              staffId: 'sara',
              staffName: 'سارا',
              workingHours: null,
            }),
          ],
        },
      ],
      serviceDurationMinutes: 60,
      slotDurationMinutes: 30,
      searchMode: 'specific',
      todayDate: '2026-05-05',
      nowTime: '09:00',
    })

    expect(result).toEqual({
      slot: null,
      emptyReason: AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW,
    })
  })
})
