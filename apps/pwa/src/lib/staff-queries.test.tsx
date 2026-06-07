// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  getApiV1StaffQueryKey,
  staffListQueryOptions,
  useCreateStaffMutation,
} from '#/lib/staff-queries'

const getApiV1Staff = vi.fn()
const postApiV1Staff = vi.fn()
vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Staff: (...args: unknown[]) => getApiV1Staff(...args),
  postApiV1Staff: (...args: unknown[]) => postApiV1Staff(...args),
  getApiV1StaffByIdSchedule: vi.fn(),
  getApiV1StaffBookingAvailability: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  getApiV1Staff.mockReset()
  postApiV1Staff.mockReset()
})

describe('staff-queries', () => {
  it('exposes generated staff list query keys', () => {
    expect(getApiV1StaffQueryKey()[0]._id).toBe('getApiV1Staff')
  })

  it('selects staff from the generated list response', async () => {
    getApiV1Staff.mockResolvedValue({
      data: { staff: [{ id: 'staff-1', name: 'Sara' }] },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(staffListQueryOptions())

    expect(data).toEqual([{ id: 'staff-1', name: 'Sara' }])
  })

  it('creates staff via generated mutation helper', async () => {
    postApiV1Staff.mockResolvedValue({
      data: {
        user: { id: 'staff-2', name: 'Neda', phone: '09120000000' },
      },
    })

    const { result } = renderHook(() => useCreateStaffMutation(), { wrapper })

    const created = await result.current.mutateAsync({
      name: 'Neda',
      phone: '09120000000',
      password: 'securepass1',
      confirmPassword: 'securepass1',
      role: 'staff',
    })

    expect(created.id).toBe('staff-2')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
