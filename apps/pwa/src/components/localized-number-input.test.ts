import { describe, expect, it } from 'vitest'

import {
  caretFromDigitCount,
  countLocalizedDigits,
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
    expect(formatLocalizedNumberInput('1234')).toBe('۱٬۲۳۴')
    expect(parseOptionalLocalizedInteger('۱۲۳۴')).toBe(1234)
  })

  it('groups thousands and keeps an in-progress decimal', () => {
    expect(formatLocalizedNumberInput(100_000)).toBe('۱۰۰٬۰۰۰')
    expect(formatLocalizedNumberInput('12.5')).toBe('۱۲٫۵')
    expect(formatLocalizedNumberInput('12.')).toBe('۱۲٫')
    expect(normalizeLocalizedIntegerInput('۱۰۰٬۰۰۰')).toBe('100000')
    expect(normalizeLocalizedDecimalInput('۱٬۲۳۴٫۵')).toBe('1234.5')
  })

  it('places the caret after the same digit count once grouping is applied', () => {
    expect(countLocalizedDigits('۱۲٬')).toBe(2)
    expect(caretFromDigitCount('۱٬۲۳۴', 2)).toBe(3)
    expect(caretFromDigitCount('۱٬۲۳۴', 4)).toBe(5)
  })

  it('normalizes localized decimal input while keeping one separator', () => {
    expect(normalizeLocalizedDecimalInput('۱۲٫۵')).toBe('12.5')
    expect(normalizeLocalizedDecimalInput('١٢,٥')).toBe('12.5')
    expect(normalizeLocalizedDecimalInput('12.5.0٪')).toBe('12.50')
  })
})
