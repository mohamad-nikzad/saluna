// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { AppointmentListPage } from './appointment-list-page'

const query = vi.hoisted(() => ({
  data: Array.from({ length: 26 }, (_, index) => ({
    id: `appointment-${index}`,
    date: '2026-09-08',
    startTime: '09:00',
    endTime: '10:00',
    status: 'completed',
    serviceId: 'service',
    bookedServiceName: 'خدمت تاریخی',
    client: {
      name: `مشتری ${index}`,
      phone: `0912000${String(index).padStart(4, '0')}`,
    },
    staff: { name: 'پرسنل اصلی' },
    staffAssignments: [
      { staffId: 'lead', staff: { name: 'پرسنل اصلی' } },
      { staffId: 'extra', staff: { name: 'پرسنل دوم' } },
    ],
  })),
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => query,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode
    to: string
    search: Record<string, string>
  }) => <a href={`${to}?${new URLSearchParams(search)}`}>{children}</a>,
}))
vi.mock('#/components/page-header-back-button', () => ({
  PageHeaderBackButton: () => null,
}))

afterEach(() => {
  cleanup()
  query.isError = false
})

describe('appointment list', () => {
  it('paginates the full results and resets to page one after searching with Persian digits', () => {
    render(<AppointmentListPage />)
    const list = () =>
      within(screen.getByRole('region', { name: 'فهرست نوبت‌ها' }))
    expect(list().getAllByRole('link')).toHaveLength(25)
    fireEvent.click(screen.getByRole('button', { name: 'صفحه بعد' }))
    expect(list().getAllByRole('link')).toHaveLength(1)
    fireEvent.change(screen.getByRole('textbox', { name: 'جستجوی مشتری' }), {
      target: { value: '۰۹۱۲۰۰۰۰۰۰۰' },
    })
    expect(list().getAllByRole('link')).toHaveLength(1)
    expect(list().getByRole('link').getAttribute('href')).toBe(
      '/calendar?date=2026-09-08&appointmentId=appointment-0',
    )
    expect(
      screen.queryByRole('navigation', { name: 'صفحه‌های نوبت‌ها' }),
    ).toBeNull()
  })

  it('shows an empty result without hiding the filters', () => {
    render(<AppointmentListPage />)
    fireEvent.change(screen.getByRole('textbox', { name: 'جستجوی مشتری' }), {
      target: { value: 'ناشناخته' },
    })
    expect(screen.getByText('نوبتی با این فیلترها پیدا نشد.')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'پرسنل' })).toBeTruthy()
  })

  it('offers retry on failure instead of presenting cached results as current', () => {
    query.isError = true
    render(<AppointmentListPage />)
    expect(screen.getByRole('alert').textContent).toContain(
      'دریافت نوبت‌ها انجام نشد.',
    )
    expect(screen.queryByRole('region', { name: 'فهرست نوبت‌ها' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(query.refetch).toHaveBeenCalledOnce()
  })
})
