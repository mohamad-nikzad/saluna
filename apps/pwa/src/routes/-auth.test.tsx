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
  status: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  password: vi.fn(),
  login: vi.fn(),
  requestReset: vi.fn(),
  verifyReset: vi.fn(),
  reset: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
  setSession: vi.fn(),
  redirect: '/onboarding/welcome',
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => ({ redirect: mocks.redirect }),
  }),
  useNavigate: () => mocks.navigate,
}))
vi.mock('#/lib/api-client', () => ({
  api: {
    auth: {
      getPhoneStatus: mocks.status,
      sendPhoneOtp: mocks.send,
      verifyPhoneOtp: mocks.verify,
      completeStaffClaim: mocks.password,
      login: mocks.login,
      requestPasswordReset: mocks.requestReset,
      verifyPasswordResetOtp: mocks.verifyReset,
      resetPassword: mocks.reset,
    },
  },
}))
vi.mock('#/lib/auth', () => ({
  authQueryKey: ['auth'],
  useAuth: () => ({
    session: null,
    refresh: mocks.refresh,
    setSession: mocks.setSession,
  }),
}))
vi.mock('#/components/auth/otp-code-input', () => ({
  OtpCodeInput: ({
    value,
    onValueChange,
  }: {
    value: string
    onValueChange: (value: string) => void
  }) => (
    <input
      id="otp"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
}))
vi.mock('#/lib/active-salon', () => ({
  getPersistedActiveSalonId: () => null,
  setPersistedActiveSalonId: vi.fn(),
}))
import { destinationAfterLogin, Route } from './auth'
import { Route as SignupRoute } from './signup'

const identity = { id: 'identity', name: 'هستی', phone: '09121234567' }
const staff = {
  status: 'ready',
  user: { ...identity, role: 'staff', salonId: 'salon-a' },
} as AuthSession
let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  mocks.send.mockResolvedValue({})
  mocks.verify.mockResolvedValue({})
  mocks.password.mockResolvedValue({})
  mocks.redirect = '/onboarding/welcome'
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})
afterEach(() => {
  cleanup()
  client.clear()
})
async function mount() {
  const component = Route.options.component
  if (!component) throw new Error('Missing auth page')
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <Suspense fallback={null}>{createElement(component)}</Suspense>
      </QueryClientProvider>,
    )
  })
}
async function enterPhone() {
  fireEvent.change(await screen.findByLabelText('شماره موبایل'), {
    target: { value: identity.phone },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))
}
async function setPassword() {
  fireEvent.change(await screen.findByLabelText('رمز عبور'), {
    target: { value: 'secret123' },
  })
  fireEvent.change(screen.getByLabelText('تکرار رمز عبور'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ساخت رمز و ادامه' }))
}

it.each([false, true])(
  'guides first-time invited identities, registered=%s, with repeat SMS disabled',
  async (registered) => {
    mocks.status.mockResolvedValue({
      registered,
      hasPassword: false,
      otpLoginEnabled: false,
    })
    mocks.refresh
      .mockResolvedValueOnce({ status: 'needs_staff_password', user: identity })
      .mockResolvedValueOnce({ status: 'needs_staff_invite', user: identity })
    await mount()
    await enterPhone()
    expect(await screen.findByText('اولین ورود شما')).toBeTruthy()
    expect(screen.queryByText('رمز عبور را فراموش کرده‌اید؟')).toBeNull()
    expect(mocks.send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'دریافت کد تایید' }))
    fireEvent.change(await screen.findByLabelText('کد تایید'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'تایید شماره و ادامه' }))
    await setPassword()
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: '/staff-invites',
        replace: true,
      }),
    )
    expect(mocks.password).toHaveBeenCalledWith({ password: 'secret123' })
    expect(mocks.requestReset).not.toHaveBeenCalled()
  },
)

it('enters accepted staff access after password creation without another invitation acceptance', async () => {
  mocks.status.mockResolvedValue({
    registered: true,
    hasPassword: false,
    otpLoginEnabled: false,
  })
  mocks.refresh
    .mockResolvedValueOnce({ status: 'needs_staff_password', user: identity })
    .mockResolvedValueOnce(staff)
  await mount()
  await enterPhone()
  fireEvent.click(
    await screen.findByRole('button', { name: 'دریافت کد تایید' }),
  )
  fireEvent.change(await screen.findByLabelText('کد تایید'), {
    target: { value: '123456' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'تایید شماره و ادامه' }))
  await setPassword()
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: '/today',
      replace: true,
    }),
  )
})

it('keeps password recovery for completed users and ignores their old onboarding redirect', async () => {
  mocks.status.mockResolvedValue({
    registered: true,
    hasPassword: true,
    otpLoginEnabled: false,
  })
  mocks.requestReset.mockResolvedValue({})
  mocks.verifyReset.mockResolvedValue({ token: 'reset-token' })
  mocks.reset.mockResolvedValue({})
  mocks.login.mockResolvedValue(staff)
  await mount()
  await enterPhone()
  expect(await screen.findByText('ورود با رمز عبور')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'ورود با کد پیامکی' })).toBeNull()
  fireEvent.click(
    screen.getByRole('button', { name: 'رمز عبور را فراموش کرده‌اید؟' }),
  )
  fireEvent.change(await screen.findByLabelText('کد تایید'), {
    target: { value: '123456' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'تایید کد' }))
  fireEvent.change(await screen.findByLabelText('رمز عبور جدید'), {
    target: { value: 'secret123' },
  })
  fireEvent.change(screen.getByLabelText('تکرار رمز عبور جدید'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ثبت رمز عبور جدید' }))
  expect(await screen.findByText(/رمز عبور با موفقیت تغییر کرد/)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('رمز عبور'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ورود' }))
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: '/today',
      replace: true,
    }),
  )
  expect(mocks.reset).toHaveBeenCalledWith({
    token: 'reset-token',
    newPassword: 'secret123',
  })
})

it.each([
  '/signup',
  '/signup?create=true',
  '/onboarding/hours',
  '//evil.test',
  '/\\evil.test',
])('routes staff safely when reopening %s', (saved) => {
  expect(destinationAfterLogin(staff!, saved)).toBe('/today')
})
it('retains owner redirects and sends unresolved access to the access page', () => {
  const owner = {
    status: 'ready',
    user: { ...identity, role: 'manager' },
  } as NonNullable<AuthSession>
  expect(destinationAfterLogin(owner, '/onboarding')).toBe('/onboarding')
  expect(
    destinationAfterLogin(
      { status: 'needs_workspace', user: identity },
      '/onboarding',
    ),
  ).toBe('/staff-invites')
})
it('requires an explicit salon creation choice when opening an old signup link', async () => {
  const beforeLoad = SignupRoute.options.beforeLoad
  if (!beforeLoad) throw new Error('Missing signup guard')
  const context = {
    queryClient: {
      ensureQueryData: vi
        .fn()
        .mockResolvedValue({ status: 'needs_workspace', user: identity }),
    },
  }
  await expect(
    beforeLoad({ context, search: {} } as never),
  ).rejects.toBeTruthy()
  await expect(
    beforeLoad({ context, search: { create: true } } as never),
  ).resolves.toBeUndefined()
})

it('keeps Salon Owner password login and its saved setup destination', async () => {
  mocks.status.mockResolvedValue({
    registered: true,
    hasPassword: true,
    otpLoginEnabled: false,
  })
  mocks.login.mockResolvedValue({
    status: 'ready',
    user: { ...identity, role: 'manager', salonId: 'salon-a' },
  })
  await mount()
  await enterPhone()
  fireEvent.change(await screen.findByLabelText('رمز عبور'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ورود' }))
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: '/onboarding/welcome',
      replace: true,
    }),
  )
  expect(mocks.send).not.toHaveBeenCalled()
})

it('takes multi-salon staff directly to their salon picker after password login', async () => {
  mocks.status.mockResolvedValue({
    registered: true,
    hasPassword: true,
    otpLoginEnabled: false,
  })
  mocks.login.mockResolvedValue({
    status: 'needs_salon_selection',
    user: identity,
    salons: [
      { salonId: 'salon-a', salonName: 'سالن اول', staffProfileId: 'staff-a' },
      { salonId: 'salon-b', salonName: 'سالن دوم', staffProfileId: 'staff-b' },
    ],
  })
  await mount()
  await enterPhone()
  fireEvent.change(await screen.findByLabelText('رمز عبور'), {
    target: { value: 'secret123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ورود' }))
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: '/select-salon',
      replace: true,
    }),
  )
})

it('takes a new number without salon access to access guidance after verification', async () => {
  mocks.status.mockResolvedValue({
    registered: false,
    hasPassword: false,
    otpLoginEnabled: false,
  })
  mocks.refresh.mockResolvedValue({
    status: 'needs_workspace',
    user: { ...identity, hasPassword: false },
  })
  await mount()
  await enterPhone()
  fireEvent.click(
    await screen.findByRole('button', { name: 'دریافت کد تایید' }),
  )
  fireEvent.change(await screen.findByLabelText('کد تایید'), {
    target: { value: '123456' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'تایید شماره و ادامه' }))
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: '/staff-invites',
      replace: true,
    }),
  )
})
