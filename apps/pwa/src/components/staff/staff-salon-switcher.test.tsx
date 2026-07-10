// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: {
    id: 'u1',
    role: 'staff' as const,
    salonId: 'salon-a',
    salonName: 'سالن آ',
    name: 'Staff',
    phone: '09120000000',
  },
  salons: [
    {
      salonId: 'salon-a',
      salonName: 'سالن آ',
      staffProfileId: 'p-a',
    },
    {
      salonId: 'salon-b',
      salonName: 'سالن ب',
      staffProfileId: 'p-b',
    },
  ],
  listStaffSalons: vi.fn(),
  navigate: vi.fn(),
  setSession: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
}))

vi.mock('#/lib/auth', () => ({
  authQueryKey: ['auth', 'me'],
  useAuth: () => ({
    user: mocks.user,
    setSession: mocks.setSession,
  }),
}))

vi.mock('#/lib/api-client', () => ({
  api: {
    auth: {
      listStaffSalons: mocks.listStaffSalons,
      me: vi.fn(),
    },
  },
}))

vi.mock('#/lib/apply-active-salon', () => ({
  applyActiveSalonSelection: vi.fn(),
}))

import { StaffSalonSwitcher } from './staff-salon-switcher'

function renderWithQuery(children: ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = {
    id: 'u1',
    role: 'staff',
    salonId: 'salon-a',
    salonName: 'سالن آ',
    name: 'Staff',
    phone: '09120000000',
  }
  mocks.listStaffSalons.mockResolvedValue({ salons: mocks.salons })
})

afterEach(cleanup)

describe('StaffSalonSwitcher', () => {
  it('shows the current salon name on staff screens', async () => {
    renderWithQuery(<StaffSalonSwitcher />)
    expect(await screen.findByText('سالن آ')).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: 'تغییر سالن' }),
    ).toBeTruthy()
  })

  it('hides the switcher control affordance for single-salon staff', async () => {
    mocks.listStaffSalons.mockResolvedValue({
      salons: [mocks.salons[0]],
    })
    renderWithQuery(<StaffSalonSwitcher />)
    expect(await screen.findByText('سالن آ')).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: 'سالن فعال: سالن آ' }),
    ).toBeTruthy()
  })
})
