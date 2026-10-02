import { describe, expect, it } from 'vitest'
import { formatJalaliDate, formatJalaliMonthDay } from './jalali'

describe('formatJalaliDate', () => {
  it('formats day and year without thousands separators', () => {
    expect(formatJalaliDate('2026-08-22')).toBe('۳۱ مرداد ۱۴۰۵')
  })
})

describe('formatJalaliMonthDay', () => {
  it('formats month and day only', () => {
    expect(formatJalaliMonthDay('2026-08-22')).toBe('۳۱ مرداد')
  })
})
