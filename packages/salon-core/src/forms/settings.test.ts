import { describe, expect, it } from 'vitest'

import { businessSettingsSchema } from './settings'

describe('businessSettingsSchema', () => {
  it('normalizes Persian digits in hours and slot duration', () => {
    const result = businessSettingsSchema.parse({
      workingStart: '۰۹:۰۰',
      workingEnd: '۱۹:۰۰',
      slotDurationMinutes: '۳۰',
    })

    expect(result).toEqual({
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
    })
  })

  it('rejects end before start when both are provided', () => {
    const result = businessSettingsSchema.safeParse({
      workingStart: '19:00',
      workingEnd: '09:00',
      slotDurationMinutes: 30,
    })

    expect(result.success).toBe(false)
  })

  it('accepts a valid workingDays bitmask', () => {
    const result = businessSettingsSchema.safeParse({ workingDays: 126 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.workingDays).toBe(126)
  })

  it('rejects workingDays of zero when provided', () => {
    expect(businessSettingsSchema.safeParse({ workingDays: 0 }).success).toBe(false)
  })

  it.each([127])('accepts boundary workingDays %i', (value) => {
    expect(businessSettingsSchema.safeParse({ workingDays: value }).success).toBe(
      true,
    )
  })

  it.each([-1, 128, 12.5])('rejects out-of-range workingDays %s', (value) => {
    expect(businessSettingsSchema.safeParse({ workingDays: value }).success).toBe(
      false,
    )
  })
})
