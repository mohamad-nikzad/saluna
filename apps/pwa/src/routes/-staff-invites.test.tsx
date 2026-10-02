// @vitest-environment jsdom
import { createElement, Suspense } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  accept: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useRouteContext: () => ({ session: { status: 'needs_staff_invite' } }),
  }),
  redirect: vi.fn(),
  useNavigate: () => mocks.navigate,
}))
vi.mock('#/lib/api-client', () => ({
  api: {
    auth: {
      listStaffInvites: mocks.list,
      acceptStaffInvite: mocks.accept,
      declineStaffInvite: vi.fn(),
    },
  },
}))
vi.mock('#/lib/active-salon', () => ({ clearPersistedActiveSalonId: vi.fn() }))
vi.mock('#/lib/auth', () => ({
  authQueryKey: ['auth'],
  useAuth: () => ({ refresh: mocks.refresh }),
}))
import { Route } from './staff-invites'

const invite = {
  id: 'invite',
  salonName: 'آراویرا',
  staffName: 'هستی',
  status: 'expired',
  expiresAt: '2020-01-01',
}
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

it.each(['pending', 'expired'])(
  'explains %s expired invitations and shows accept after renewal',
  async (status) => {
    mocks.list.mockResolvedValue({ invites: [{ ...invite, status }] })
    mocks.refresh.mockResolvedValue({ status: 'needs_staff_password' })
    const component = Route.options.component
    if (!component) throw new Error('Missing invitations page')
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <Suspense fallback={null}>{createElement(component)}</Suspense>
        </QueryClientProvider>,
      )
    })
    expect(await screen.findByText(/مهلت این دعوت تمام شده است/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'پذیرفتن' })).toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()
    mocks.list.mockResolvedValue({
      invites: [{ ...invite, status: 'pending', expiresAt: '2099-01-01' }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'بررسی دوباره' }))
    expect(await screen.findByRole('button', { name: 'پذیرفتن' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'پذیرفتن' }))
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('invite'))
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/auth',
        replace: true,
      }),
    )
    client.clear()
  },
)
