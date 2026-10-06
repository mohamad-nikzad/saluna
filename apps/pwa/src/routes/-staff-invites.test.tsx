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
import type { AuthSession } from '#/lib/auth'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
  session: {
    status: 'needs_staff_invite',
    user: {},
  } as NonNullable<AuthSession>,
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useRouteContext: () => ({ session: mocks.session }),
  }),
  redirect: vi.fn(),
  useNavigate: () => mocks.navigate,
}))
vi.mock('#/lib/api-client', () => ({
  api: {
    auth: {
      listStaffInvites: mocks.list,
      acceptStaffInvite: mocks.accept,
      declineStaffInvite: mocks.decline,
    },
  },
}))
vi.mock('#/lib/active-salon', () => ({ clearPersistedActiveSalonId: vi.fn() }))
vi.mock('#/lib/auth', () => ({
  authQueryKey: ['auth'],
  useAuth: () => ({ refresh: mocks.refresh, logout: mocks.logout }),
}))
import { Route } from './staff-invites'

const invite = {
  id: 'invite',
  salonName: 'آراویرا',
  staffName: 'هستی',
  status: 'expired',
  expiresAt: '2020-01-01',
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = {
    status: 'needs_staff_invite',
    user: { id: 'staff', name: 'هستی', phone: '09121234567' },
  }
})
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

it('lets staff enter their accepted salon while another invitation is expired', async () => {
  mocks.session = {
    status: 'ready',
    user: {
      id: 'staff',
      name: 'هستی',
      phone: '09121234567',
      role: 'staff',
      salonId: 'salon-a',
    },
  } as NonNullable<AuthSession>
  mocks.list.mockResolvedValue({ invites: [invite] })
  mocks.refresh.mockResolvedValue(mocks.session)
  const client = await mountInvites()
  expect(await screen.findByText(/مهلت این دعوت تمام شده است/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'ادامه به سالن‌های من' }))
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/today',
      replace: true,
    }),
  )
  expect(mocks.accept).not.toHaveBeenCalled()
  expect(mocks.decline).not.toHaveBeenCalled()
  client.clear()
})

async function mountInvites() {
  const component = Route.options.component
  if (!component) throw new Error('Missing invitations page')
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <Suspense fallback={null}>{createElement(component)}</Suspense>
      </QueryClientProvider>,
    )
  })
  return client
}

it('keeps unresolved access on the page until the person explicitly creates their salon', async () => {
  mocks.list.mockResolvedValue({ invites: [] })
  mocks.refresh.mockResolvedValue({ status: 'needs_workspace' })
  const client = await mountInvites()
  expect(await screen.findByText('هنوز به سالنی دسترسی ندارید')).toBeTruthy()
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  expect(mocks.navigate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'ساخت سالن خودم' }))
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: '/signup',
    search: { create: true },
  })
  client.clear()
})

it('lets staff decline the final invitation without starting salon signup', async () => {
  mocks.list
    .mockResolvedValueOnce({
      invites: [{ ...invite, status: 'pending', expiresAt: '2099-01-01' }],
    })
    .mockResolvedValue({ invites: [] })
  mocks.decline.mockResolvedValue({})
  mocks.refresh.mockResolvedValue({ status: 'needs_workspace' })
  const client = await mountInvites()
  expect(await screen.findByText('آراویرا')).toBeTruthy()
  expect(screen.getByText('دعوت برای هستی')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'رد کردن' }))
  expect(await screen.findByText('هنوز به سالنی دسترسی ندارید')).toBeTruthy()
  expect(mocks.decline).toHaveBeenCalledWith('invite')
  expect(mocks.accept).not.toHaveBeenCalled()
  expect(mocks.navigate).not.toHaveBeenCalled()
  client.clear()
})

it.each([
  [{ status: 'ready', user: { role: 'staff' } }, '/today'],
  [{ status: 'needs_salon_selection' }, '/select-salon'],
] as const)(
  'continues accepted access when there are no invitations: %s',
  async (session, destination) => {
    mocks.list.mockResolvedValue({ invites: [] })
    mocks.refresh.mockResolvedValue(session)
    const client = await mountInvites()
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: destination,
        replace: true,
      }),
    )
    client.clear()
  },
)

it.each(['pending', 'expired'])(
  'lets multi-salon staff continue to accepted salons despite a %s invitation',
  async (status) => {
    mocks.session = {
      status: 'needs_salon_selection',
      user: { id: 'staff', name: 'هستی', phone: '09121234567' },
      salons: [
        {
          salonId: 'salon-a',
          salonName: 'سالن اول',
          staffProfileId: 'staff-a',
        },
        {
          salonId: 'salon-b',
          salonName: 'سالن دوم',
          staffProfileId: 'staff-b',
        },
      ],
    }
    mocks.list.mockResolvedValue({
      invites: [
        {
          ...invite,
          status,
          expiresAt: status === 'expired' ? '2020-01-01' : '2099-01-01',
        },
      ],
    })
    mocks.refresh.mockResolvedValue(mocks.session)
    const client = await mountInvites()
    expect(await screen.findByText('آراویرا')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'ادامه به سالن‌های من' }),
    )
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/select-salon',
        replace: true,
      }),
    )
    expect(mocks.accept).not.toHaveBeenCalled()
    expect(mocks.decline).not.toHaveBeenCalled()
    client.clear()
  },
)
