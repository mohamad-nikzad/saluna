import { describe, expect, it } from 'vitest'
import {
  durationMinutesSchema,
  hexColorSchema,
  jalaliDateSchema,
  optionalPhoneSchema,
  persianDigitsSchema,
  phoneSchema,
  requiredTextSchema,
} from './primitives'

describe('phoneSchema', () => {
  it('normalizes Persian digits and separators to Latin digit-only', () => {
    expect(phoneSchema.parse('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('09123456789')
  })

  it('accepts already-normalized Latin phone', () => {
    expect(phoneSchema.parse('09123456789')).toBe('09123456789')
  })

  it('canonicalizes +98 international prefix to 09', () => {
    expect(phoneSchema.parse('+989123456789')).toBe('09123456789')
    expect(phoneSchema.parse('989123456789')).toBe('09123456789')
  })

  it('rejects empty', () => {
    expect(() => phoneSchema.parse('')).toThrow()
  })

  it('rejects too-short input', () => {
    expect(() => phoneSchema.parse('091')).toThrow()
  })

  it('rejects non-digit garbage (post-normalization length zero)', () => {
    expect(() => phoneSchema.parse('abc')).toThrow()
  })

  it('rejects Iranian landline numbers', () => {
    expect(() => phoneSchema.parse('+98 21 5669 8841')).toThrow()
    expect(() => phoneSchema.parse('02156698841')).toThrow()
    expect(() => phoneSchema.parse('02112345678')).toThrow()
  })
})

describe('optionalPhoneSchema', () => {
  it('returns null for empty / null / undefined', () => {
    expect(optionalPhoneSchema.parse('')).toBeNull()
    expect(optionalPhoneSchema.parse(null)).toBeNull()
    expect(optionalPhoneSchema.parse(undefined)).toBeNull()
  })

  it('normalizes valid phone', () => {
    expect(optionalPhoneSchema.parse('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
  })

  it('rejects too-short non-empty value', () => {
    expect(() => optionalPhoneSchema.parse('123')).toThrow()
  })
})

describe('jalaliDateSchema', () => {
  it('accepts object form', () => {
    expect(jalaliDateSchema.parse({ jy: 1404, jm: 1, jd: 26 })).toEqual({
      jy: 1404,
      jm: 1,
      jd: 26,
    })
  })

  it('accepts "yyyy/mm/dd" string with Persian digits', () => {
    expect(jalaliDateSchema.parse('۱۴۰۴/۰۱/۲۶')).toEqual({
      jy: 1404,
      jm: 1,
      jd: 26,
    })
  })

  it('rejects out-of-range month', () => {
    expect(() => jalaliDateSchema.parse({ jy: 1404, jm: 13, jd: 1 })).toThrow()
  })

  it('rejects Esfand-30 in a non-leap year', () => {
    // 1402 is not a Jalali leap year — Esfand has 29 days.
    expect(() => jalaliDateSchema.parse({ jy: 1402, jm: 12, jd: 30 })).toThrow()
  })

  it('rejects garbage', () => {
    expect(() => jalaliDateSchema.parse('not-a-date')).toThrow()
  })
})

describe('hexColorSchema', () => {
  it('accepts #RRGGBB', () => {
    expect(hexColorSchema.parse('#A1B2C3')).toBe('#A1B2C3')
  })

  it('accepts Persian digit hex', () => {
    expect(hexColorSchema.parse('#۱۲۳abc')).toBe('#123abc')
  })

  it('rejects 3-digit shorthand', () => {
    expect(() => hexColorSchema.parse('#abc')).toThrow()
  })

  it('rejects missing hash', () => {
    expect(() => hexColorSchema.parse('A1B2C3')).toThrow()
  })
})

describe('durationMinutesSchema', () => {
  it('accepts number', () => {
    expect(durationMinutesSchema.parse(45)).toBe(45)
  })

  it('parses Persian-digit string', () => {
    expect(durationMinutesSchema.parse('۶۰')).toBe(60)
  })

  it('rejects zero and negative', () => {
    expect(() => durationMinutesSchema.parse(0)).toThrow()
    expect(() => durationMinutesSchema.parse(-5)).toThrow()
  })

  it('rejects > 24h', () => {
    expect(() => durationMinutesSchema.parse(24 * 60 + 1)).toThrow()
  })

  it('rejects non-numeric', () => {
    expect(() => durationMinutesSchema.parse('abc')).toThrow()
  })
})

describe('persianDigitsSchema', () => {
  it('normalizes Persian digits', () => {
    expect(persianDigitsSchema.parse('۱۲۳۴')).toBe('1234')
  })

  it('rejects mixed letters', () => {
    expect(() => persianDigitsSchema.parse('12a3')).toThrow()
  })
})

describe('requiredTextSchema', () => {
  it('trims and accepts non-empty', () => {
    expect(requiredTextSchema.parse('  hello  ')).toBe('hello')
  })

  it('rejects whitespace-only', () => {
    expect(() => requiredTextSchema.parse('   ')).toThrow()
  })
})
