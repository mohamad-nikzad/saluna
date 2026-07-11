import { describe, expect, it } from 'vitest'
import {
  addDaysYmd,
  salonCurrentHm,
  salonHmAfterMinutes,
  salonTodayYmd,
} from './salon-local-time'

describe('salon local time', () => {
  it('formats the salon calendar day in Tehran time', () => {
    expect(salonTodayYmd(new Date('2026-04-28T21:00:00.000Z'))).toBe(
      '2026-04-29',
    )
  })

  it('formats HH:mm and offsets in Tehran time', () => {
    const anchor = new Date('2026-04-28T21:00:00.000Z')
    expect(salonCurrentHm(anchor)).toBe('00:30')
    expect(salonHmAfterMinutes(120, anchor)).toBe('02:30')
  })

  it('adds days to YYYY-MM-DD values without depending on host timezone', () => {
    expect(addDaysYmd('2026-04-29', 1)).toBe('2026-04-30')
    expect(addDaysYmd('2026-04-29', -60)).toBe('2026-02-28')
  })
})
