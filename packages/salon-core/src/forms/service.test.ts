import { describe, expect, it } from 'vitest'

import {
  serviceAddonFormSchema,
  serviceAddonScopeInputSchema,
  serviceFormSchema,
  servicePackageBookingCreateSchema,
  servicePackageStaffUpdateSchema,
  serviceUpdateSchema,
} from './service'

describe('serviceFormSchema', () => {
  it('trims name and normalizes numeric Persian-digit strings', () => {
    const result = serviceFormSchema.parse({
      name: '  کوتاهی مو  ',
      categoryId: 'cat1',
      category: 'hair',
      duration: '۶۰',
      price: '۲۵۰۰۰۰',
      color: 'mint',
      active: true,
    })

    expect(result).toEqual({
      name: 'کوتاهی مو',
      categoryId: 'cat1',
      category: 'hair',
      duration: 60,
      price: 250000,
      color: 'mint',
      active: true,
    })
  })

  it('defaults active to true and legacy color ids to calendar color ids', () => {
    const result = serviceFormSchema.parse({
      name: 'مانیکور',
      categoryId: 'cat1',
      category: 'nails',
      duration: 45,
      price: 0,
      color: 'bg-staff-2',
    })

    expect(result.active).toBe(true)
    expect(result.color).toBe('violet')
  })

  it('rejects empty name', () => {
    const result = serviceFormSchema.safeParse({
      name: '   ',
      category: 'hair',
      duration: 45,
      price: 0,
      color: 'rose',
    })

    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = serviceFormSchema.safeParse({
      name: 'x',
      category: 'massage',
      duration: 45,
      price: 0,
      color: 'rose',
    })

    expect(result.success).toBe(false)
  })

  it('rejects invalid duration and negative price', () => {
    expect(
      serviceFormSchema.safeParse({
        name: 'x',
        category: 'hair',
        duration: 0,
        price: 100,
        color: 'rose',
      }).success,
    ).toBe(false)

    expect(
      serviceFormSchema.safeParse({
        name: 'x',
        category: 'hair',
        duration: 45,
        price: -1,
        color: 'rose',
      }).success,
    ).toBe(false)
  })

  it('rejects cleared numeric strings instead of coercing them to zero', () => {
    expect(
      serviceFormSchema.safeParse({
        name: 'x',
        categoryId: 'cat1',
        category: 'hair',
        duration: '',
        price: 100,
        color: 'rose',
      }).success,
    ).toBe(false)

    expect(
      serviceFormSchema.safeParse({
        name: 'x',
        categoryId: 'cat1',
        category: 'hair',
        duration: 45,
        price: '',
        color: 'rose',
      }).success,
    ).toBe(false)
  })
})

describe('serviceAddonFormSchema', () => {
  it('normalizes localized numeric strings', () => {
    const result = serviceAddonFormSchema.parse({
      name: 'رنگساژ',
      priceDelta: '۱۵۰۰۰۰',
      durationDelta: '۳۰',
      sortOrder: '۲',
      scopes: [{ type: 'service', serviceId: 'svc-1' }],
    })

    expect(result).toMatchObject({
      priceDelta: 150000,
      durationDelta: 30,
      sortOrder: 2,
    })
  })

  it('rejects cleared add-on numeric strings instead of coercing them to zero', () => {
    expect(
      serviceAddonFormSchema.safeParse({
        name: 'رنگساژ',
        priceDelta: '۱۰۰۰',
        durationDelta: '',
        sortOrder: 0,
        scopes: [{ type: 'service', serviceId: 'svc-1' }],
      }).success,
    ).toBe(false)

    expect(
      serviceAddonFormSchema.safeParse({
        name: 'رنگساژ',
        priceDelta: '۱۰۰۰',
        durationDelta: 0,
        sortOrder: '',
        scopes: [{ type: 'service', serviceId: 'svc-1' }],
      }).success,
    ).toBe(false)
  })

  it('accepts simplified all/category/service scopes and rejects family scopes', () => {
    expect(serviceAddonScopeInputSchema.parse({ type: 'all' })).toEqual({
      type: 'all',
    })
    expect(
      serviceAddonScopeInputSchema.parse({
        type: 'category',
        categoryId: 'cat-1',
      }),
    ).toEqual({ type: 'category', categoryId: 'cat-1' })
    expect(
      serviceAddonScopeInputSchema.parse({
        type: 'service',
        serviceId: 'svc-1',
      }),
    ).toEqual({ type: 'service', serviceId: 'svc-1' })
    expect(
      serviceAddonScopeInputSchema.safeParse({
        type: 'family',
        familyId: 'fam-1',
      }).success,
    ).toBe(false)
  })
})

describe('serviceUpdateSchema legacy catalog field handling', () => {
  it('strips familyId and kind from update payloads', () => {
    const result = serviceUpdateSchema.parse({
      name: 'x',
      familyId: null,
      kind: 'combo',
    })

    expect(result).toEqual({ name: 'x' })
  })
})

describe('servicePackageBookingCreateSchema', () => {
  const booking = {
    clientId: 'client-1',
    date: '2026-07-02',
    tasks: [
      {
        packageComponentId: 'component-1',
        staffId: 'staff-1',
        startTime: '10:00',
        endTime: '11:00',
      },
    ],
  }

  it('requires packageComponentId for each task', () => {
    expect(servicePackageBookingCreateSchema.parse(booking)).toEqual(booking)
    expect(
      servicePackageBookingCreateSchema.safeParse({
        ...booking,
        tasks: [
          {
            componentOrder: 0,
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('servicePackageStaffUpdateSchema', () => {
  it('accepts staff capability replacement payloads', () => {
    expect(
      servicePackageStaffUpdateSchema.parse({ staffIds: ['staff-2'] }),
    ).toEqual({ staffIds: ['staff-2'] })
    expect(servicePackageStaffUpdateSchema.parse({})).toEqual({ staffIds: [] })
  })
})
