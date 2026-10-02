import { describe, expect, it } from 'vitest'

import {
  allocatePackagePrice,
  allocateWorkBasis,
  commissionAmount,
  equalWorkAllocations,
  validateWorkAllocations,
  percentageToBasisPoints,
} from './commissions'

describe('Appointment Work Allocations', () => {
  it('splits exactly and gives the rounding remainder to the lead', () => {
    const allocations = equalWorkAllocations(['lead', 'second', 'third'])
    expect(allocations.map((row) => row.allocationBasisPoints)).toEqual([
      3334, 3333, 3333,
    ])
    expect(
      validateWorkAllocations(['lead', 'second', 'third'], allocations),
    ).toBe(true)
    expect(allocateWorkBasis(100, allocations)).toEqual([34, 33, 33])
  })
})

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
