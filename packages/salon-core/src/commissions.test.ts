import { describe, expect, it } from 'vitest'

import {
  allocatePackagePrice,
  commissionAmount,
  commissionPeriodRange,
  percentageToBasisPoints,
} from './commissions'

describe('Staff Commission calculations', () => {
  it('validates two-decimal percentages and rounds each Appointment to toman', () => {
    expect(percentageToBasisPoints(12.34)).toBe(1234)
    expect(commissionAmount(101, 5000)).toBe(51)
    expect(() => percentageToBasisPoints(0)).toThrow()
    expect(() => percentageToBasisPoints(100.01)).toThrow()
    expect(() => percentageToBasisPoints(12.345)).toThrow()
  })

  it('allocates the booked package price proportionally and exactly in task order', () => {
    expect(allocatePackagePrice(100, [100, 100, 100])).toEqual([34, 33, 33])
    expect(allocatePackagePrice(550, [100, 200, 300])).toEqual([92, 183, 275])
  })
})

describe('Staff Commission reporting periods', () => {
  const now = new Date('2026-07-17T20:45:00.000Z') // 2026-07-18 in Tehran

  it('uses Tehran today, Saturday-to-Friday week, and current Jalali month', () => {
    expect(commissionPeriodRange({ period: 'today', now })).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-18',
    })
    expect(commissionPeriodRange({ period: 'week', now })).toEqual({
      startDate: '2026-07-18',
      endDate: '2026-07-24',
    })
    expect(commissionPeriodRange({ period: 'month', now })).toEqual({
      startDate: '2026-06-22',
      endDate: '2026-07-22',
    })
  })

  it('keeps both custom endpoints and rejects reversed ranges', () => {
    expect(
      commissionPeriodRange({
        period: 'custom',
        startDate: '2026-01-03',
        endDate: '2026-01-04',
        now,
      }),
    ).toEqual({ startDate: '2026-01-03', endDate: '2026-01-04' })
    expect(() =>
      commissionPeriodRange({
        period: 'custom',
        startDate: '2026-01-05',
        endDate: '2026-01-04',
        now,
      }),
    ).toThrow()
  })
})
