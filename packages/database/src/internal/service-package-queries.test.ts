import { describe, expect, it } from 'vitest'
import {
  normalizeServicePackageName,
  resolveServicePackagePrice,
  validatePackageComponentReplacement,
  validatePackageStaffReplacement,
} from './service-package-queries'

describe('service package component replacement validation', () => {
  it('allows active standard service variants', () => {
    expect(() =>
      validatePackageComponentReplacement({
        serviceIds: ['svc-1', 'svc-2'],
        foundServices: [
          { id: 'svc-1', active: true, kind: 'standard' },
          { id: 'svc-2', active: true, kind: 'standard' },
        ],
      }),
    ).not.toThrow()
  })

  it('rejects duplicate, missing, inactive, and legacy combo components', () => {
    expect(() =>
      validatePackageComponentReplacement({
        serviceIds: ['svc-1', 'svc-1'],
        foundServices: [{ id: 'svc-1', active: true, kind: 'standard' }],
      }),
    ).toThrow('service package components cannot contain duplicates')

    expect(() =>
      validatePackageComponentReplacement({
        serviceIds: ['svc-1', 'svc-2'],
        foundServices: [{ id: 'svc-1', active: true, kind: 'standard' }],
      }),
    ).toThrow('service package component service not found')

    expect(() =>
      validatePackageComponentReplacement({
        serviceIds: ['svc-1'],
        foundServices: [{ id: 'svc-1', active: false, kind: 'standard' }],
      }),
    ).toThrow('service package components must be active services')

    expect(() =>
      validatePackageComponentReplacement({
        serviceIds: ['svc-1'],
        foundServices: [{ id: 'svc-1', active: true, kind: 'combo' }],
      }),
    ).toThrow('service package cannot contain legacy combo services')
  })
})

describe('service package price behavior', () => {
  it('uses explicit package price override when present', () => {
    expect(
      resolveServicePackagePrice({
        priceOverride: 450000,
        componentPriceTotal: 600000,
      }),
    ).toBe(450000)
  })

  it('falls back to the included service price sum when override is null', () => {
    expect(
      resolveServicePackagePrice({
        priceOverride: null,
        componentPriceTotal: 600000,
      }),
    ).toBe(600000)
  })
})

describe('service package staff capability validation', () => {
  it('rejects duplicate and missing staff ids', () => {
    expect(() =>
      validatePackageStaffReplacement({
        staffIds: ['staff-1', 'staff-2'],
        foundStaffIds: ['staff-2', 'staff-1'],
      }),
    ).not.toThrow()

    expect(() =>
      validatePackageStaffReplacement({
        staffIds: ['staff-1', 'staff-1'],
        foundStaffIds: ['staff-1'],
      }),
    ).toThrow('service package staff capabilities cannot contain duplicates')

    expect(() =>
      validatePackageStaffReplacement({
        staffIds: ['staff-1', 'staff-2'],
        foundStaffIds: ['staff-1'],
      }),
    ).toThrow('service package staff capability staff not found')
  })
})

describe('service package name normalization', () => {
  it('normalizes names for duplicate prevention', () => {
    expect(normalizeServicePackageName('  پکیج   عروس  ')).toBe('پکیج عروس')
  })
})
