import { ApiError } from '@repo/api-client/errors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { AdminShell } from './admin-shell'

const authMeQuery = vi.hoisted(() => ({
  queryFn: vi.fn(),
}))

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuthMeOptions: () => ({
    queryKey: ['admin-auth-me-test'],
    queryFn: authMeQuery.queryFn,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
}))

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  )
}

describe('AdminShell', () => {
  beforeEach(() => {
    authMeQuery.queryFn.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows login prompt when auth me returns 401', async () => {
    authMeQuery.queryFn.mockRejectedValue(
      new ApiError('Unauthorized', 401, null),
    )

    renderWithProviders(<AdminShell />)

    expect(await screen.findByText('ورود به پنل ادمین الزامی است')).toBeTruthy()
    expect(
      screen.getByText(
        'با حسابی که نقش فعال ادمین پلتفرم دارد وارد شوید.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /رفتن به صفحه ورود/ }).getAttribute('href'),
    ).toBe('/login')
  })

  it('shows access denied when auth me returns 403', async () => {
    authMeQuery.queryFn.mockRejectedValue(
      new ApiError('Forbidden', 403, null),
    )

    renderWithProviders(<AdminShell />)

    expect(await screen.findByText('دسترسی به پنل ادمین مجاز نیست')).toBeTruthy()
    expect(
      screen.getByText(
        'نشست شما معتبر است، اما این حساب اجازه دسترسی به پنل ادمین Saluna را ندارد.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /رفتن به صفحه ورود/ }).getAttribute('href'),
    ).toBe('/login')
  })
})
