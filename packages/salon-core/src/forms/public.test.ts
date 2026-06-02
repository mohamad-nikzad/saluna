import { describe, expect, it } from 'vitest'

import {
  PUBLIC_ONBOARDING_BIO_MAX_LENGTH,
  publicPageOnboardingSchema,
} from './public'

describe('publicPageOnboardingSchema', () => {
  it('accepts enabled with a bio', () => {
    const result = publicPageOnboardingSchema.parse({
      enabled: true,
      bioText: 'سالن زیبایی رز',
    })
    expect(result).toEqual({ enabled: true, bioText: 'سالن زیبایی رز' })
  })

  it('accepts enabled without a bio', () => {
    const result = publicPageOnboardingSchema.parse({ enabled: false })
    expect(result.enabled).toBe(false)
    expect(result.bioText).toBeUndefined()
  })

  it('collapses an empty bio to undefined', () => {
    const result = publicPageOnboardingSchema.parse({
      enabled: true,
      bioText: '   ',
    })
    expect(result.bioText).toBeUndefined()
  })

  it('requires the enabled flag', () => {
    expect(publicPageOnboardingSchema.safeParse({ bioText: 'x' }).success).toBe(
      false,
    )
  })

  it('accepts a bio at the max length', () => {
    const bioText = 'a'.repeat(PUBLIC_ONBOARDING_BIO_MAX_LENGTH)
    expect(
      publicPageOnboardingSchema.safeParse({ enabled: true, bioText }).success,
    ).toBe(true)
  })

  it('rejects a bio longer than the max length', () => {
    const bioText = 'a'.repeat(PUBLIC_ONBOARDING_BIO_MAX_LENGTH + 1)
    expect(
      publicPageOnboardingSchema.safeParse({ enabled: true, bioText }).success,
    ).toBe(false)
  })
})
