// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getStaff: vi.fn(),
  getCatalog: vi.fn(),
  getReport: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode
    to: string
    'aria-label'?: string
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@repo/ui/jalali-date-picker', () => ({
  JalaliDatePicker: ({ value }: { value: string }) => (
    <button type="button">{value}</button>
  ),
}))

vi.mock('#/lib/staff-queries', () => ({
  staffListQueryOptions: () => ({
    queryKey: ['staff-list'],
    queryFn: mocks.getStaff,
  }),
}))

vi.mock('#/lib/services-queries', () => ({
  serviceCatalogQueryOptions: () => ({
    queryKey: ['service-catalog'],
    queryFn: mocks.getCatalog,
  }),
}))

vi.mock('#/lib/commission-queries', () => ({
  salonMoneyReportQueryOptions: (query: unknown) => ({
    queryKey: ['salon-money-report', query],
    queryFn: () => mocks.getReport(query),
  }),
}))

import { SalonReportsPage } from './salon-reports-page'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SalonReportsPage />
    </QueryClientProvider>,
  )
}

const sampleReport = {
  startDate: '2026-07-23',
  endDate: '2026-08-22',
  summary: {
    bookedTotal: 1_500_000,
    staffCommissionTotal: 300_000,
    salonRetainedAmount: 1_200_000,
  },
  staff: [
    {
      staffProfileId: 'staff-1',
      staffName: 'سارا',
      completedCount: 2,
      commissionBasisTotal: 1_500_000,
      staffCommissionTotal: 300_000,
    },
  ],
  appointments: Array.from({ length: 12 }, (_, index) => ({
    appointmentId: `appt-${index + 1}`,
    date: '2026-08-01',
    clientName: `مشتری ${index + 1}`,
    serviceName: 'کوتاهی',
    staffNames: ['سارا'],
    bookedTotal: 125_000,
    commissions: [
      {
        staffProfileId: 'staff-1',
        staffName: 'سارا',
        basis: 125_000,
        percentage: 20,
        amount: 25_000,
      },
    ],
  })),
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getStaff.mockResolvedValue([
    { id: 'staff-1', name: 'سارا', role: 'staff' },
    { id: 'mgr-1', name: 'مدیر', role: 'manager' },
  ])
  mocks.getCatalog.mockResolvedValue({
    categories: [
      { id: 'cat-1', name: 'مو' },
      { id: 'cat-2', name: 'ناخن' },
    ],
    services: [
      { id: 'svc-1', name: 'کوتاهی', categoryId: 'cat-1' },
      { id: 'svc-2', name: 'مانیکور', categoryId: 'cat-2' },
    ],
  })
  mocks.getReport.mockResolvedValue(sampleReport)
})

afterEach(() => {
  cleanup()
})

describe('SalonReportsPage', () => {
  it('uses design-system selects instead of native select elements', async () => {
    const { container } = renderPage()

    expect(await screen.findByRole('heading', { name: 'گزارش سالن' })).toBeTruthy()
    expect(container.querySelectorAll('select')).toHaveLength(0)
    expect(screen.getByRole('combobox', { name: 'فیلتر پرسنل' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'فیلتر دسته' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'فیلتر خدمت' })).toBeTruthy()
  })

  it('shows booked totals by default and reveals commission on toggle', async () => {
    renderPage()

    expect(await screen.findByText('مبلغ نوبت‌های انجام‌شده')).toBeTruthy()
    expect(screen.queryByText('کمیسیون پرسنل')).toBeNull()
    expect(screen.queryByText('خلاصه پرسنل')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'نمایش کمیسیون' }))

    expect(screen.getByText('کمیسیون پرسنل')).toBeTruthy()
    expect(screen.getByText('مبلغ باقی‌مانده سالن')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'خلاصه پرسنل' })).toBeTruthy()
  })

  it('paginates appointments and opens calendar detail from a row', async () => {
    renderPage()

    expect(await screen.findByText('مشتری 1 · کوتاهی')).toBeTruthy()
    expect(screen.getByText('مشتری 10 · کوتاهی')).toBeTruthy()
    expect(screen.queryByText('مشتری 11 · کوتاهی')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'نمایش بیشتر' }))
    expect(screen.getByText('مشتری 11 · کوتاهی')).toBeTruthy()

    fireEvent.click(screen.getByText('مشتری 1 · کوتاهی'))
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/calendar',
      search: {
        date: '2026-08-01',
        appointmentId: 'appt-1',
      },
    })
  })

  it('filters staff from the staff summary when commission is shown', async () => {
    renderPage()

    await screen.findByText('مبلغ نوبت‌های انجام‌شده')
    fireEvent.click(screen.getByRole('button', { name: 'نمایش کمیسیون' }))

    const staffSection = screen
      .getByRole('heading', { name: 'خلاصه پرسنل' })
      .closest('section')
    expect(staffSection).toBeTruthy()
    fireEvent.click(within(staffSection!).getByRole('button', { name: /سارا/ }))

    expect(mocks.getReport).toHaveBeenCalledWith(
      expect.objectContaining({ staffProfileId: 'staff-1' }),
    )
  })
})
