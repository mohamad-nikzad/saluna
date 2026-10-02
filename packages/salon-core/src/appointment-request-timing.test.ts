import { describe, expect, it } from 'vitest'

import {
  flexibleRequestAgreementError,
  flexibleRequestGroup,
  isFlexibleRequestExpired,
  isStartTimeInPreference,
  nextSalonWeekDates,
  normalizeAcceptableDates,
} from './appointment-request-timing'

describe('Flexible AppointmentRequest timing', () => {
  it.each([
    { finalDate: '2026-07-20', startTime: '12:00', error: 'date' },
    { finalDate: '2026-07-21', startTime: '12:00', error: null },
    { finalDate: '2026-07-22', startTime: '12:00', error: 'date' },
    { finalDate: '2026-10-19', startTime: '16:59', error: null },
    { finalDate: '2026-10-20', startTime: '12:00', error: 'date' },
    { finalDate: '2026-09-31', startTime: '12:00', error: 'date' },
    { finalDate: '2026-07-21', startTime: '11:59', error: 'time' },
    { finalDate: '2026-07-21', startTime: '17:00', error: 'time' },
    { finalDate: '2026-07-21', startTime: '24:00', error: 'time' },
  ])(
    'checks the saved agreement for $finalDate at $startTime',
    ({ finalDate, startTime, error }) => {
      expect(
        flexibleRequestAgreementError({
          acceptableDates: [
            '2026-07-20',
            '2026-07-21',
            '2026-09-31',
            '2026-10-19',
            '2026-10-20',
          ],
          timePreference: 'afternoon',
          finalDate,
          startTime,
          today: '2026-07-21',
        }),
      ).toBe(error)
    },
  )

  it('rejects missing agreement details', () => {
    const slot = {
      finalDate: '2026-07-21',
      startTime: '12:00',
      today: '2026-07-21',
    }
    for (const acceptableDates of [null, []]) {
      expect(
        flexibleRequestAgreementError({
          ...slot,
          acceptableDates,
          timePreference: 'any',
        }),
      ).toBe('date')
    }
    expect(
      flexibleRequestAgreementError({
        ...slot,
        acceptableDates: [slot.finalDate],
        timePreference: null,
      }),
    ).toBe('time')
  })

  it('normalizes unique dates within the inclusive Request Horizon', () => {
    expect(
      normalizeAcceptableDates(['2026-07-31', '2026-07-21'], '2026-07-21'),
    ).toEqual(['2026-07-21', '2026-07-31'])
    expect(normalizeAcceptableDates(['2026-10-19'], '2026-07-21')).toEqual([
      '2026-10-19',
    ])
    expect(() =>
      normalizeAcceptableDates(['2026-07-21', '2026-07-21'], '2026-07-21'),
    ).toThrow('unique')
    expect(() =>
      normalizeAcceptableDates(['2026-10-20'], '2026-07-21'),
    ).toThrow('Request Horizon')
  })

  it('resolves next week to the following Salon-local Saturday–Friday week', () => {
    expect(nextSalonWeekDates('2026-07-21')).toEqual([
      '2026-07-25',
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
    ])
    expect(nextSalonWeekDates('2026-07-25')[0]).toBe('2026-08-01')
  })

  it('applies fixed half-open Time Preference boundaries to start times', () => {
    expect(isStartTimeInPreference('00:00', 'morning')).toBe(true)
    expect(isStartTimeInPreference('12:00', 'morning')).toBe(false)
    expect(isStartTimeInPreference('12:00', 'afternoon')).toBe(true)
    expect(isStartTimeInPreference('17:00', 'afternoon')).toBe(false)
    expect(isStartTimeInPreference('17:00', 'evening')).toBe(true)
    expect(isStartTimeInPreference('23:59', 'evening')).toBe(true)
    expect(isStartTimeInPreference('23:59', 'any')).toBe(true)
  })

  it('groups by the earliest remaining date and keeps elapsed-only history separate', () => {
    expect(
      flexibleRequestGroup(['2026-07-20', '2026-07-24'], '2026-07-21'),
    ).toEqual({ group: 'this-week', earliestRemainingDate: '2026-07-24' })
    expect(
      flexibleRequestGroup(['2026-07-20', '2026-07-25'], '2026-07-21'),
    ).toEqual({ group: 'next-week', earliestRemainingDate: '2026-07-25' })
    // From 2026-08-01: next week ends 2026-08-14; Jalali month ends 2026-08-22.
    expect(flexibleRequestGroup(['2026-08-20'], '2026-08-01')).toEqual({
      group: 'this-month',
      earliestRemainingDate: '2026-08-20',
    })
    expect(
      flexibleRequestGroup(['2026-07-20', '2026-08-08'], '2026-07-21'),
    ).toEqual({ group: 'next-month', earliestRemainingDate: '2026-08-08' })
    expect(flexibleRequestGroup(['2026-10-01'], '2026-08-01')).toEqual({
      group: 'later',
      earliestRemainingDate: '2026-10-01',
    })
    expect(flexibleRequestGroup(['2026-07-20'], '2026-07-21')).toEqual({
      group: 'elapsed',
      earliestRemainingDate: null,
    })
  })

  it('expires only after the final acceptable Salon-local date ends', () => {
    const dates = ['2026-07-20', '2026-07-21']
    expect(
      isFlexibleRequestExpired(dates, new Date('2026-07-21T20:29:59.000Z')),
    ).toBe(false)
    expect(
      isFlexibleRequestExpired(dates, new Date('2026-07-21T20:30:00.000Z')),
    ).toBe(true)
  })
})
