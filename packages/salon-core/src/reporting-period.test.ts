import { describe, expect, it } from 'vitest'

import { reportingPeriodRange } from './reporting-period'
import { salonLocalInclusiveRangeInstants } from './salon-local-time'

describe('Reporting Period', () => {
  const now = new Date('2026-07-17T20:45:00.000Z') // 2026-07-18 in Tehran

  it('uses Tehran today, Saturday-to-Friday Salon Week, and current Jalali Month', () => {
    expect(reportingPeriodRange({ period: 'today', now })).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-18',
    })
    expect(reportingPeriodRange({ period: 'week', now })).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-24',
    })
    expect(reportingPeriodRange({ period: 'month', now })).toEqual({
      startDate: '2026-06-22',
      endDate: '2026-07-22',
    })
  })

  it('maps an inclusive Salon-local Date range to Tehran midnight instants', () => {
    const month = reportingPeriodRange({ period: 'month', now })
    expect(salonLocalInclusiveRangeInstants(month)).toEqual({
      start: new Date('2026-06-21T20:30:00.000Z'),
      endExclusive: new Date('2026-07-22T20:30:00.000Z'),
    })
  })
})
