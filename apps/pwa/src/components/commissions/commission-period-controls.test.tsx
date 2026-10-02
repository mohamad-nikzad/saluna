// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/ui/jalali-date-picker', () => ({
  JalaliDatePicker: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) => (
    <button type="button" onClick={() => onChange('2026-07-20')}>
      {value}
    </button>
  ),
}))

import { CommissionPeriodControls } from './commission-period-controls'

describe('CommissionPeriodControls', () => {
  afterEach(cleanup)

  it('selects an inclusive custom range', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <CommissionPeriodControls
        value={{ period: 'today' }}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'بازه دلخواه' }))
    expect(onChange).toHaveBeenCalledWith({
      period: 'custom',
      startDate: expect.any(String),
      endDate: expect.any(String),
    })

    rerender(
      <CommissionPeriodControls
        value={{
          period: 'custom',
          startDate: '2026-07-01',
          endDate: '2026-07-31',
        }}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText('2026-07-01'))
    expect(onChange).toHaveBeenLastCalledWith({
      period: 'custom',
      startDate: '2026-07-20',
      endDate: '2026-07-31',
    })
  })

  it('selects the previous Jalali Month', () => {
    const onChange = vi.fn()
    render(
      <CommissionPeriodControls
        value={{ period: 'month' }}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'ماه قبل' }))
    expect(onChange).toHaveBeenCalledWith({ period: 'previousMonth' })
  })
})
