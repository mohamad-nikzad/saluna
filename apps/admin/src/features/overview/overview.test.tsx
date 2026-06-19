import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import type { AdminOverviewResponse } from '@repo/api-client/types'

import { OverviewScreen } from './index'

const overviewQuery = vi.hoisted(() => ({
  queryFn: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: string
    children: ReactNode
  }) => <a href={to}>{children}</a>,
}))

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminOverviewOptions: () => ({
    queryKey: ['admin-overview-test'],
    queryFn: overviewQuery.queryFn,
  }),
}))

function renderOverview() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <OverviewScreen />
    </QueryClientProvider>,
  )
}

const populatedOverview: AdminOverviewResponse = {
  salonsByStatus: {
    active: 7,
    suspended: 2,
    archived: 1,
  },
  failedDeliveries: 3,
  messagingAccounts: [
    {
      provider: 'bale',
      enabled: true,
      value: 4,
    },
  ],
  recentAuditEvents: [
    {
      action: 'salon.status.updated',
      targetType: 'salon',
      targetId: 'salon_123456789',
      createdAt: '2026-06-18T10:30:00.000Z',
    },
  ],
}

describe('OverviewScreen', () => {
  beforeEach(() => {
    overviewQuery.queryFn.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders real platform metrics and recent audit targets from the generated query', async () => {
    overviewQuery.queryFn.mockResolvedValue(populatedOverview)

    renderOverview()

    expect(await screen.findByText('سالن‌های فعال')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('2 تعلیق‌شده')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('bale فعال')).toBeTruthy()
    expect(screen.getByText('salon.status.updated')).toBeTruthy()
    expect(screen.getByText('salon · salon_12')).toBeTruthy()
  })

  it('links metric cards to salons and audit section to audit log', async () => {
    overviewQuery.queryFn.mockResolvedValue(populatedOverview)

    renderOverview()

    await screen.findByText('سالن‌های فعال')

    expect(
      screen.getByRole('link', { name: /سالن‌های فعال/ }).getAttribute('href'),
    ).toBe('/salons')
    expect(
      screen.getByRole('link', { name: /سالن‌های آرشیوشده/ }).getAttribute('href'),
    ).toBe('/salons')
    expect(
      screen.getByRole('link', { name: /رویدادهای ممیزی اخیر/ }).getAttribute('href'),
    ).toBe('/audit-log')
    expect(
      screen.getByRole('link', { name: 'مشاهده همه' }).getAttribute('href'),
    ).toBe('/audit-log')
    expect(
      screen.getByRole('link', { name: /salon\.status\.updated/ }).getAttribute('href'),
    ).toBe('/audit-log')
  })

  it('renders empty states when overview lists are empty', async () => {
    overviewQuery.queryFn.mockResolvedValue({
      salonsByStatus: {
        active: 0,
        suspended: 0,
        archived: 0,
      },
      failedDeliveries: 0,
      messagingAccounts: [],
      recentAuditEvents: [],
    } satisfies AdminOverviewResponse)

    renderOverview()

    expect(
      await screen.findByText('هنوز حساب پیام‌رسانی متصل نشده است.'),
    ).toBeTruthy()
    expect(
      screen.getByText('هنوز تغییری توسط مدیر ثبت نشده است.'),
    ).toBeTruthy()
  })

  it('renders the loading state while the overview query is pending', () => {
    overviewQuery.queryFn.mockReturnValue(new Promise(() => undefined))

    renderOverview()

    expect(screen.getByLabelText('در حال بارگذاری نمای کلی')).toBeTruthy()
  })

  it('renders an error state when the overview query fails', async () => {
    overviewQuery.queryFn.mockRejectedValue(new Error('network failed'))

    renderOverview()

    await waitFor(() => {
      expect(
        screen.getByText(
          'بارگذاری شاخص‌های نمای کلی ناموفق بود. لطفاً دوباره تلاش کنید.',
        ),
      ).toBeTruthy()
    })
  })
})
