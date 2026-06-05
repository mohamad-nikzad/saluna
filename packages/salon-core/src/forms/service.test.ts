import { describe, expect, it } from 'vitest'

import {
  serviceAddonFormSchema,
  serviceFormSchema,
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
      familyId: undefined,
      category: 'hair',
      duration: 60,
      price: 250000,
      color: 'mint',
      active: true,
      kind: 'standard',
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
})

describe('serviceUpdateSchema familyId null semantics', () => {
  it('omits familyId when absent from payload', () => {
    const result = serviceUpdateSchema.parse({ name: 'x' })
    expect(result.familyId).toBeUndefined()
    expect('familyId' in result).toBe(false)
  })

  it('preserves familyId: null to signal "clear the family"', () => {
    const result = serviceUpdateSchema.parse({ familyId: null })
    expect(result.familyId).toBeNull()
  })

  it('treats empty string familyId as null (clear)', () => {
    const result = serviceUpdateSchema.parse({ familyId: '   ' })
    expect(result.familyId).toBeNull()
  })

  it('keeps a real familyId string', () => {
    const result = serviceUpdateSchema.parse({ familyId: 'fam-123' })
    expect(result.familyId).toBe('fam-123')
  })
})
