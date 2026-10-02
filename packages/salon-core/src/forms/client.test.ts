import { describe, expect, it } from 'vitest'

import { MAX_BULK_CLIENTS } from './limits'
import {
  clientBulkCreateSchema,
  clientCreateSchema,
  clientFormSchema,
  clientUpdateSchema,
  formatJalaliBirthDateInput,
} from './client'

describe('clientFormSchema', () => {
  it('formats mobile birthday input while preserving paste and backspace', () => {
    expect(formatJalaliBirthDateInput('۱۳۷۰۰۵۱۰')).toBe('۱۳۷۰/۰۵/۱۰')
    expect(formatJalaliBirthDateInput('1370/5/10')).toBe('۱۳۷۰/۵/۱۰')
    expect(formatJalaliBirthDateInput('۱۳۷۰/۰۵/۱')).toBe('۱۳۷۰/۰۵/۱')
  })

  it('normalizes phone and trims notes', () => {
    const result = clientFormSchema.parse({
      name: '  مریم  ',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      notes: '  مشتری ثابت  ',
      acquisitionSource: 'instagram',
      tags: ['VIP', 'VIP', ' حساسیت ', ''],
    })
    expect(result.name).toBe('مریم')
    expect(result.phone).toBe('09123456789')
    expect(result.notes).toBe('مشتری ثابت')
    expect(result.acquisitionSource).toBe('instagram')
    expect(result.tags).toEqual(['VIP', 'حساسیت'])
  })

  it('coerces empty notes to undefined', () => {
    const result = clientFormSchema.parse({
      name: 'علی',
      phone: '09123456789',
      notes: '   ',
      tags: [],
    })
    expect(result.notes).toBeUndefined()
  })

  it('rejects empty name', () => {
    const result = clientFormSchema.safeParse({
      name: '   ',
      phone: '09123456789',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid phone', () => {
    const result = clientFormSchema.safeParse({ name: 'x', phone: '12' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown acquisition source', () => {
    const result = clientFormSchema.safeParse({
      name: 'x',
      phone: '09123456789',
      acquisitionSource: 'billboard',
    })
    expect(result.success).toBe(false)
  })

  it('caps tags at MAX_CLIENT_TAGS', () => {
    const tags = Array.from({ length: 12 }, (_, i) => `t${i}`)
    const result = clientFormSchema.safeParse({
      name: 'x',
      phone: '09123456789',
      tags,
    })
    expect(result.success).toBe(false)
  })

  it('defaults tags to []', () => {
    const result = clientFormSchema.parse({
      name: 'x',
      phone: '09123456789',
    })
    expect(result.tags).toEqual([])
  })

  it('accepts a complete past Jalali birth date and rejects future dates', () => {
    expect(
      clientFormSchema.parse({
        name: 'x',
        phone: '09123456789',
        birthDate: '۱۳۷۰/۰۵/۱۰',
      }).birthDate,
    ).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(
      clientFormSchema.safeParse({
        name: 'x',
        phone: '09123456789',
        birthDate: '۱۵۰۰/۰۱/۰۱',
      }).success,
    ).toBe(false)
    expect(
      clientFormSchema.safeParse({
        name: 'x',
        phone: '09123456789',
        birthDate: '1991-08-01',
      }).success,
    ).toBe(false)
  })

  it('clears an entered birth date with an empty value', () => {
    expect(clientUpdateSchema.parse({ birthDate: '' })).toEqual({
      birthDate: null,
    })
  })
})

describe('client server schemas', () => {
  it('normalizes create ids and defaults tags', () => {
    const result = clientCreateSchema.parse({
      id: 'local-1',
      name: '  مریم  ',
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
    })
    expect(result).toMatchObject({
      id: 'local-1',
      name: 'مریم',
      phone: '09123456789',
      tags: [],
    })
  })

  it('allows partial updates and normalizes provided fields', () => {
    const result = clientUpdateSchema.parse({
      phone: '۰۹۱۲۳۴۵۶۷۸۹',
      tags: [' VIP ', 'VIP', ''],
    })
    expect(result).toEqual({
      phone: '09123456789',
      tags: ['VIP'],
    })
  })
})

describe('clientBulkCreateSchema', () => {
  it('rejects an empty clients array', () => {
    const result = clientBulkCreateSchema.safeParse({ clients: [] })
    expect(result.success).toBe(false)
  })

  it(`rejects more than ${MAX_BULK_CLIENTS} clients`, () => {
    const clients = Array.from(
      { length: MAX_BULK_CLIENTS + 1 },
      (_, index) => ({
        name: `Client ${index}`,
        phone: '09123456789',
      }),
    )
    const result = clientBulkCreateSchema.safeParse({ clients })
    expect(result.success).toBe(false)
  })

  it(`accepts up to ${MAX_BULK_CLIENTS} clients`, () => {
    const clients = Array.from({ length: MAX_BULK_CLIENTS }, (_, index) => ({
      name: `Client ${index}`,
      phone: `0912${String(index).padStart(7, '0')}`,
    }))
    const result = clientBulkCreateSchema.safeParse({ clients })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.clients).toHaveLength(MAX_BULK_CLIENTS)
    }
  })
})
