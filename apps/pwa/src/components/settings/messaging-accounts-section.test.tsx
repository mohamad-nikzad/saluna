// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  listAccounts: vi.fn(),
  setEnabled: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('#/lib/auth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('#/lib/api-client', () => ({
  api: {
    messaging: {
      listAccounts: mocks.listAccounts,
      createLink: vi.fn(),
      setEnabled: mocks.setEnabled,
      unlink: mocks.unlink,
    },
  },
}))

import { MessagingAccountsSection } from './messaging-accounts-section'

function renderWithQuery(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({
    user: { id: 'u1', role: 'manager' },
    loading: false,
    logout: vi.fn(),
    refresh: vi.fn(),
    setUser: vi.fn(),
  })
  mocks.listAccounts.mockResolvedValue({
    providers: [
      { id: 'telegram', displayName: 'Telegram' },
      { id: 'bale', displayName: 'Bale' },
    ],
    accounts: [],
  })
})

afterEach(() => {
  cleanup()
})

describe('MessagingAccountsSection', () => {
  it('renders Telegram and Bale connection rows for managers', async () => {
    renderWithQuery(<MessagingAccountsSection />)

    expect(await screen.findByText('اتصال تلگرام')).toBeTruthy()
    expect(screen.getByText('اتصال بله')).toBeTruthy()
  })

  it('hides unconfigured provider rows when there is no linked account', async () => {
    mocks.listAccounts.mockResolvedValue({
      providers: [{ id: 'telegram', displayName: 'Telegram' }],
      accounts: [],
    })

    renderWithQuery(<MessagingAccountsSection />)

    expect(await screen.findByText('اتصال تلگرام')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByText('اتصال بله')).toBeNull()
    })
  })

  it('shows linked Telegram and Bale accounts independently', async () => {
    mocks.listAccounts.mockResolvedValue({
      providers: [{ id: 'telegram', displayName: 'Telegram' }],
      accounts: [
        {
          id: 'telegram-account',
          provider: 'telegram',
          displayName: 'مدیر تلگرام',
          enabled: true,
          linkedAt: '2026-06-07T00:00:00.000Z',
        },
        {
          id: 'bale-account',
          provider: 'bale',
          displayName: 'مدیر بله',
          enabled: false,
          linkedAt: '2026-06-07T00:00:00.000Z',
        },
      ],
    })

    renderWithQuery(<MessagingAccountsSection />)

    expect(await screen.findByText('اعلان تلگرام')).toBeTruthy()
    expect(screen.getByText('متصل به مدیر تلگرام')).toBeTruthy()
    expect(screen.getByText('اعلان بله')).toBeTruthy()
    expect(screen.getByText('متصل به مدیر بله')).toBeTruthy()
  })
})
