// @vitest-environment jsdom
import { useState } from 'react'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { format } from 'date-fns'
import { CalendarHeader } from './calendar-header'
import { calendarMonthRange } from './calendar-month'
import { SalonFullCalendar } from './salon-full-calendar'
import type { CalendarView } from '@repo/salon-core/types'

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  )
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Calendar({ onDay = vi.fn(), onRange = vi.fn() }) {
  const [date, setDate] = useState(new Date(2026, 8, 12, 12))
  const [view, setView] = useState<CalendarView>('month')
  return (
    <>
      <CalendarHeader
        titleAnchor={date}
        navigationDate={date}
        view={view}
        onDateChange={setDate}
        onToday={() => setDate(new Date(2026, 8, 12, 12))}
      />
      <button onClick={() => setView('week')}>week</button>
      <button onClick={() => setView('month')}>month</button>
      <SalonFullCalendar
        appointments={[]}
        currentDate={date}
        view={view}
        onVisibleRangeChange={onRange}
        onSlotSelect={vi.fn()}
        onEventClick={vi.fn()}
        onDaySummaryOpen={onDay}
      />
    </>
  )
}

function monthDays(container: HTMLElement) {
  return [
    ...container.querySelectorAll('.fc-daygrid-day:not(.fc-day-other)'),
  ].map((cell) => cell.getAttribute('data-date'))
}

describe('Persian month calendar', () => {
  it('renders all of Shahrivar with weekday-only headers and opens day 1', async () => {
    const onDay = vi.fn()
    const onRange = vi.fn()
    const { container } = render(<Calendar onDay={onDay} onRange={onRange} />)
    expect(
      screen.getByRole('button', { name: 'انتخاب تاریخ' }).textContent,
    ).toContain('شهریور')
    expect(monthDays(container)).toHaveLength(31)
    expect(monthDays(container)[0]).toBe('2026-08-23')
    expect(monthDays(container).at(-1)).toBe('2026-09-22')
    expect(
      [...container.querySelectorAll('.fc-col-header-cell')].map(
        (el) => el.textContent,
      ),
    ).toEqual([
      'شنبه',
      'یکشنبه',
      'دوشنبه',
      'سه‌شنبه',
      'چهارشنبه',
      'پنجشنبه',
      'جمعه',
    ])
    expect(container.querySelector('.day-header-num')).toBeNull()
    expect(
      container.querySelectorAll('.fc-daygrid-body tbody tr'),
    ).toHaveLength(5)
    expect(onRange).toHaveBeenLastCalledWith(
      '2026-08-22',
      '2026-09-25',
      expect.any(Date),
    )
    const firstDay = await screen.findByRole('button', {
      name: '۱ شهریور ۱۴۰۵',
    })
    expect(firstDay.textContent).toContain('۱')
    fireEvent.keyDown(firstDay, { key: 'Enter' })
    expect(onDay).toHaveBeenLastCalledWith('2026-08-23')
  })

  it('navigates Persian months, returns to today, and keeps week dates', async () => {
    const { container } = render(<Calendar />)
    fireEvent.click(screen.getByRole('button', { name: 'بعدی' }))
    await waitFor(() => expect(monthDays(container)[0]).toBe('2026-09-23'))
    expect(monthDays(container)).toHaveLength(30)
    expect(
      screen.getByRole('button', { name: 'انتخاب تاریخ' }).textContent,
    ).toContain('مهر')
    fireEvent.click(screen.getByRole('button', { name: 'قبلی' }))
    await waitFor(() => expect(monthDays(container)[0]).toBe('2026-08-23'))
    fireEvent.click(screen.getByRole('button', { name: 'قبلی' }))
    await waitFor(() => expect(monthDays(container)[0]).toBe('2026-07-23'))
    fireEvent.click(screen.getByRole('button', { name: 'امروز' }))
    await waitFor(() => expect(monthDays(container)[0]).toBe('2026-08-23'))
    fireEvent.click(screen.getByRole('button', { name: 'week' }))
    await waitFor(() =>
      expect(container.querySelectorAll('.day-header-num')).toHaveLength(7),
    )
    fireEvent.click(screen.getByRole('button', { name: 'month' }))
    await waitFor(() => expect(monthDays(container)).toHaveLength(31))
    expect(container.querySelector('.day-header-num')).toBeNull()
  })

  it.each([
    ['2025-03-10', 0, '2025-02-19', '2025-03-21'],
    ['2026-03-10', 0, '2026-02-20', '2026-03-21'],
    ['2026-03-10', 1, '2026-03-21', '2026-04-21'],
    ['2026-03-21', -1, '2026-02-20', '2026-03-21'],
  ])(
    'uses correct Esfand and year boundaries for %s, offset %s',
    (date, offset, start, end) => {
      const range = calendarMonthRange(new Date(`${date}T12:00:00`), offset)
      expect(format(range.start, 'yyyy-MM-dd')).toBe(start)
      expect(format(range.end, 'yyyy-MM-dd')).toBe(end)
    },
  )
})
