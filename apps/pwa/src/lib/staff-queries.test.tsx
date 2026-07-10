// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  getApiV1StaffQueryKey,
  staffListQueryOptions,
  useCancelStaffInviteMutation,
  useCreateStaffMutation,
  useResendStaffInviteMutation,
} from '#/lib/staff-queries'

const getApiV1Staff = vi.fn()
const postApiV1Staff = vi.fn()
const postApiV1StaffByIdInviteCancel = vi.fn()
const postApiV1StaffByIdInviteResend = vi.fn()
vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Staff: (...args: unknown[]) => getApiV1Staff(...args),
  postApiV1Staff: (...args: unknown[]) => postApiV1Staff(...args),
  postApiV1StaffByIdInviteCancel: (...args: unknown[]) =>
    postApiV1StaffByIdInviteCancel(...args),
  postApiV1StaffByIdInviteResend: (...args: unknown[]) =>
    postApiV1StaffByIdInviteResend(...args),
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
  postApiV1StaffByIdInviteCancel.mockReset()
  postApiV1StaffByIdInviteResend.mockReset()
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
      role: 'staff',
    })

    expect(created.id).toBe('staff-2')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('cancels a pending invite via generated mutation helper', async () => {
    postApiV1StaffByIdInviteCancel.mockResolvedValue({
      data: {
        success: true,
        invite: {
          id: 'invite-1',
          status: 'revoked',
          revokedAt: '2026-07-11T12:00:00.000Z',
        },
        profile: { id: 'profile-1', name: 'Ali', active: true },
      },
    })

    const { result } = renderHook(() => useCancelStaffInviteMutation(), {
      wrapper,
    })

    await result.current.mutateAsync('profile-1')

    expect(postApiV1StaffByIdInviteCancel).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'profile-1' } }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('resends a pending invite via generated mutation helper', async () => {
    postApiV1StaffByIdInviteResend.mockResolvedValue({
      data: {
        inviteToken: 'new-token',
        invite: {
          id: 'invite-1',
          status: 'pending',
          expiresAt: '2026-07-25T12:00:00.000Z',
          lastDeliveredAt: '2026-07-11T12:00:00.000Z',
        },
        profile: { id: 'profile-1', name: 'Ali' },
      },
    })

    const { result } = renderHook(() => useResendStaffInviteMutation(), {
      wrapper,
    })

    const resent = await result.current.mutateAsync('profile-1')

    expect(postApiV1StaffByIdInviteResend).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'profile-1' } }),
    )
    expect(resent).toEqual({
      inviteToken: 'new-token',
      invite: {
        id: 'invite-1',
        status: 'pending',
        expiresAt: '2026-07-25T12:00:00.000Z',
        lastDeliveredAt: '2026-07-11T12:00:00.000Z',
      },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
