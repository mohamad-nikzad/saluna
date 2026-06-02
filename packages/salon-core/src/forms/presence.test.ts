import { describe, expect, it } from 'vitest'

import {
  EMPTY_PRESENCE_INPUT,
  presenceSchema,
  presenceToInput,
} from './presence'

describe('presenceToInput', () => {
  it('maps nullish API fields to empty strings', () => {
    expect(presenceToInput(null)).toEqual(EMPTY_PRESENCE_INPUT)
    expect(
      presenceToInput({
        address: 'تهران',
        mapGoogle: null,
        website: undefined,
      }),
    ).toEqual({
      ...EMPTY_PRESENCE_INPUT,
      address: 'تهران',
    })
  })
})

describe('presenceSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = presenceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('collapses empty / whitespace strings to undefined', () => {
    const result = presenceSchema.parse({
      address: '   ',
      website: '',
      mapGoogle: null,
    })
    expect(result.address).toBeUndefined()
    expect(result.website).toBeUndefined()
    expect(result.mapGoogle).toBeUndefined()
  })

  it('rejects mapNeshan when host is nshn.ir instead of neshan.org', () => {
    const result = presenceSchema.safeParse({
      address: 'تهران، خیابان ولیعصر',
      mapGoogle: 'https://maps.app.goo.gl/abc123',
      mapNeshan: 'https://nshn.ir/foo',
      mapBalad: 'https://balad.ir/p/xyz',
      socialInstagram: '@rose.salon',
      socialTelegram: 'https://t.me/rosesalon',
      socialWhatsapp: '09123456789',
      website: 'https://rose-salon.example.com',
    })
    expect(result.success).toBe(false) // mapNeshan host is nshn.ir, not neshan.org
  })

  describe('maps', () => {
    it('accepts allowed map domains and subdomains', () => {
      const result = presenceSchema.safeParse({
        mapGoogle: 'https://maps.app.goo.gl/abc',
        mapNeshan: 'https://www.neshan.org/maps/foo',
        mapBalad: 'https://balad.ir/p/xyz',
      })
      expect(result.success).toBe(true)
    })

    it('rejects http (non-https) map urls', () => {
      expect(
        presenceSchema.safeParse({ mapGoogle: 'http://maps.app.goo.gl/abc' })
          .success,
      ).toBe(false)
    })

    it('rejects map urls from an unknown domain', () => {
      expect(
        presenceSchema.safeParse({ mapGoogle: 'https://evil.com/abc' }).success,
      ).toBe(false)
    })

    it('rejects a balad url placed in the neshan field', () => {
      expect(
        presenceSchema.safeParse({ mapNeshan: 'https://balad.ir/p/xyz' })
          .success,
      ).toBe(false)
    })
  })

  describe('socials', () => {
    it('accepts an @handle', () => {
      expect(
        presenceSchema.safeParse({ socialInstagram: '@rose_salon' }).success,
      ).toBe(true)
    })

    it('accepts an https url handle', () => {
      expect(
        presenceSchema.safeParse({ socialTelegram: 'https://t.me/rose' })
          .success,
      ).toBe(true)
    })

    it('rejects a bare handle without @ or url scheme', () => {
      expect(
        presenceSchema.safeParse({ socialInstagram: 'rose_salon' }).success,
      ).toBe(false)
    })

    it('normalizes whatsapp persian digits to canonical phone', () => {
      const result = presenceSchema.parse({
        socialWhatsapp: '۰۹۱۲۳۴۵۶۷۸۹',
      })
      expect(result.socialWhatsapp).toBe('09123456789')
    })

    it('rejects a malformed whatsapp number', () => {
      expect(
        presenceSchema.safeParse({ socialWhatsapp: '12345' }).success,
      ).toBe(false)
    })
  })

  describe('website', () => {
    it('accepts an https url', () => {
      expect(
        presenceSchema.safeParse({ website: 'https://example.com' }).success,
      ).toBe(true)
    })

    it('rejects an http url', () => {
      expect(
        presenceSchema.safeParse({ website: 'http://example.com' }).success,
      ).toBe(false)
    })

    it('rejects a non-url string', () => {
      expect(presenceSchema.safeParse({ website: 'not a url' }).success).toBe(
        false,
      )
    })
  })
})
