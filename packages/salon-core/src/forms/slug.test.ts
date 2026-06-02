import { describe, expect, it } from 'vitest'

import { slugSchema, slugUpdateSchema } from './slug'

describe('slugSchema', () => {
  it('accepts a valid slug', () => {
    expect(slugSchema.parse('rose-salon')).toBe('rose-salon')
  })

  it('rejects too-short slug', () => {
    expect(slugSchema.safeParse('ab').success).toBe(false)
  })

  it('rejects too-long slug', () => {
    expect(slugSchema.safeParse('a'.repeat(41)).success).toBe(false)
  })

  it('rejects invalid characters', () => {
    expect(slugSchema.safeParse('Invalid Slug!').success).toBe(false)
  })

  it('rejects leading or trailing hyphens', () => {
    expect(slugSchema.safeParse('-salon').success).toBe(false)
    expect(slugSchema.safeParse('salon-').success).toBe(false)
  })
})

describe('slugUpdateSchema', () => {
  it('wraps slug in an object', () => {
    expect(slugUpdateSchema.parse({ slug: 'my-salon' })).toEqual({
      slug: 'my-salon',
    })
  })
})
