import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKING_DAYS,
  isWorkingDayOpen,
  toggleWorkingDay,
} from './working-days'

describe('working-days', () => {
  it('DEFAULT_WORKING_DAYS has Saturday closed and other days open', () => {
    for (let bit = 0; bit < 7; bit += 1) {
      expect(isWorkingDayOpen(DEFAULT_WORKING_DAYS, bit)).toBe(bit !== 0)
    }
  })

  it('toggleWorkingDay flips a single bit', () => {
    const saturdayClosed = DEFAULT_WORKING_DAYS
    const saturdayOpen = toggleWorkingDay(saturdayClosed, 0)
    expect(isWorkingDayOpen(saturdayOpen, 0)).toBe(true)
    expect(toggleWorkingDay(saturdayOpen, 0)).toBe(saturdayClosed)
  })

  it('isWorkingDayOpen returns false when bit is off', () => {
    expect(isWorkingDayOpen(0, 0)).toBe(false)
    expect(isWorkingDayOpen(1, 0)).toBe(true)
  })
})
