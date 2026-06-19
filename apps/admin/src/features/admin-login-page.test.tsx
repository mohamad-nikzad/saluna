import { ApiError } from '@repo/api-client/errors'
import type { AdminMeResponse } from '@repo/api-client/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { AdminLoginPage } from './admin-login-page'

const navigate = vi.hoisted(() => vi.fn())
const authMe = vi.hoisted(() => ({
  getApiV1AdminAuthMe: vi.fn(),
  queryKey: ['admin-auth-me-test'],
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuthMeQueryKey: () => authMe.queryKey,
}))

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1AdminAuthMe: authMe.getApiV1AdminAuthMe,
}))

function renderWithProviders(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  )

  return { ...view, queryClient }
}

const adminMe: AdminMeResponse = {
  user: {
    userId: 'admin-user-id',
    name: 'Platform Owner',
    email: 'owner@saluna.test',
    phoneNumber: '+989120000000',
    username: 'owner',
    role: 'platform_owner',
    active: true,
  },
  runtime: { dataSource: 'local' },
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    navigate.mockReset()
    authMe.getApiV1AdminAuthMe.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows a generic error when sign-in fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }))

    renderWithProviders(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('شماره تلفن'), {
      target: { value: '+989120000000' },
    })
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ورود/ }))

    expect(
      await screen.findByText('شماره تلفن یا رمز عبور نادرست است.'),
    ).toBeTruthy()
    expect(authMe.getApiV1AdminAuthMe).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows a 403 message when the account is not a platform admin', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
    authMe.getApiV1AdminAuthMe.mockRejectedValue(
      new ApiError('Forbidden', 403, null),
    )

    renderWithProviders(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('شماره تلفن'), {
      target: { value: '+989120000000' },
    })
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ورود/ }))

    expect(
      await screen.findByText(
        'ورود موفق بود، اما این حساب مدیر فعال پلتفرم نیست.',
      ),
    ).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('sets auth query cache and navigates on successful login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))
    authMe.getApiV1AdminAuthMe.mockResolvedValue({ data: adminMe })

    const { queryClient } = renderWithProviders(<AdminLoginPage />)

    fireEvent.change(screen.getByLabelText('شماره تلفن'), {
      target: { value: '+989120000000' },
    })
    fireEvent.change(screen.getByLabelText('رمز عبور'), {
      target: { value: 'password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ورود/ }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: '/overview',
        replace: true,
      })
    })
    expect(queryClient.getQueryData(authMe.queryKey)).toEqual(adminMe)
  })
})
