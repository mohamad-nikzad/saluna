// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  appointmentRequestsListQueryOptions,
  getApiV1AppointmentRequestsQueryKey,
  useRenewTerminalRequestMutation,
  useUpdateDraftMutation,
} from '#/lib/appointment-requests-queries'

const getApiV1AppointmentRequests = vi.fn()
const patchApiV1AppointmentRequestsById = vi.fn()
const postApiV1AppointmentRequestsByIdRenew = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1AppointmentRequests: (...args: unknown[]) =>
    getApiV1AppointmentRequests(...args),
  patchApiV1AppointmentRequestsById: (...args: unknown[]) =>
    patchApiV1AppointmentRequestsById(...args),
  postApiV1AppointmentRequestsByIdRenew: (...args: unknown[]) =>
    postApiV1AppointmentRequestsByIdRenew(...args),
}))

beforeEach(() => {
  getApiV1AppointmentRequests.mockReset()
  patchApiV1AppointmentRequestsById.mockReset()
  postApiV1AppointmentRequestsByIdRenew.mockReset()
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('appointment-requests-queries', () => {
  it('exposes generated appointment-requests list query keys', () => {
    expect(
      getApiV1AppointmentRequestsQueryKey({
        query: { status: 'pending' },
      })[0]._id,
    ).toBe('getApiV1AppointmentRequests')
  })

  it('selects requests from the generated list response', async () => {
    getApiV1AppointmentRequests.mockResolvedValue({
      data: {
        requests: [
          {
            id: 'req-1',
            status: 'pending',
            customerName: 'Sara',
          },
        ],
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(
      appointmentRequestsListQueryOptions('pending', 'exact'),
    )

    expect(data).toEqual({
      requests: [
        {
          id: 'req-1',
          status: 'pending',
          customerName: 'Sara',
        },
      ],
    })
  })

  it('updates only a Draft timing agreement through the generated client', async () => {
    patchApiV1AppointmentRequestsById.mockResolvedValue({
      data: { request: { id: 'draft-1' } },
    })
    const { result } = renderHook(() => useUpdateDraftMutation(), { wrapper })
    const body = {
      acceptableDates: ['2026-07-25'],
      timePreference: 'evening' as const,
      notes: 'بعد از پنج',
    }

    await result.current.mutateAsync({ requestId: 'draft-1', body })

    expect(patchApiV1AppointmentRequestsById).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'draft-1' }, body }),
    )
  })

  it('loads both request origins for terminal lifecycle tabs', async () => {
    getApiV1AppointmentRequests.mockResolvedValue({ data: { requests: [] } })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    await queryClient.fetchQuery(
      appointmentRequestsListQueryOptions('cancelled', undefined),
    )

    expect(getApiV1AppointmentRequests).toHaveBeenCalledWith(
      expect.objectContaining({ query: { status: 'cancelled' } }),
    )
  })

  it('renews a terminal request with fresh timing and selected replacements', async () => {
    postApiV1AppointmentRequestsByIdRenew.mockResolvedValue({
      data: { request: { id: 'renewed-request' } },
    })
    const { result } = renderHook(() => useRenewTerminalRequestMutation(), {
      wrapper,
    })
    const body = {
      clientId: '33333333-3333-4333-8333-333333333333',
      serviceId: '44444444-4444-4444-8444-444444444444',
      acceptableDates: ['2026-07-25'],
      timePreference: 'evening' as const,
    }

    await result.current.mutateAsync({ requestId: 'source-request', body })

    expect(postApiV1AppointmentRequestsByIdRenew).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'source-request' }, body }),
    )
  })
})
