import { describe, expect, it } from 'vitest'

import {
  formatLocalizedNumberInput,
  normalizeLocalizedDecimalInput,
  normalizeLocalizedIntegerInput,
  parseOptionalLocalizedInteger,
} from './localized-number-input'

describe('localized numeric input helpers', () => {
  it('allows clearing the last digit as an intermediate value', () => {
    expect(normalizeLocalizedIntegerInput('')).toBe('')
    expect(formatLocalizedNumberInput('')).toBe('')
    expect(parseOptionalLocalizedInteger('')).toBeNull()
  })

  it('accepts Persian, Arabic, and Latin digits while rejecting other characters', () => {
    expect(normalizeLocalizedIntegerInput('۱۲3٤ دقیقه')).toBe('1234')
    expect(formatLocalizedNumberInput('1234')).toBe('۱۲۳۴')
    expect(parseOptionalLocalizedInteger('۱۲۳۴')).toBe(1234)
  })

  it('normalizes localized decimal input while keeping one separator', () => {
    expect(normalizeLocalizedDecimalInput('۱۲٫۵')).toBe('12.5')
    expect(normalizeLocalizedDecimalInput('١٢,٥')).toBe('12.5')
    expect(normalizeLocalizedDecimalInput('12.5.0٪')).toBe('12.50')
  })
})
