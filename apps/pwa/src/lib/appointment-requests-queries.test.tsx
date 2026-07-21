// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  appointmentRequestsListQueryOptions,
  getApiV1AppointmentRequestsQueryKey,
  useConvertDraftMutation,
  useUpdateDraftMutation,
} from '#/lib/appointment-requests-queries'

const getApiV1AppointmentRequests = vi.fn()
const patchApiV1AppointmentRequestsById = vi.fn()
const postApiV1AppointmentRequestsByIdConvert = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1AppointmentRequests: (...args: unknown[]) =>
    getApiV1AppointmentRequests(...args),
  patchApiV1AppointmentRequestsById: (...args: unknown[]) =>
    patchApiV1AppointmentRequestsById(...args),
  postApiV1AppointmentRequestsByIdConvert: (...args: unknown[]) =>
    postApiV1AppointmentRequestsByIdConvert(...args),
}))

beforeEach(() => {
  getApiV1AppointmentRequests.mockReset()
  patchApiV1AppointmentRequestsById.mockReset()
  postApiV1AppointmentRequestsByIdConvert.mockReset()
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
      appointmentRequestsListQueryOptions('pending'),
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

  it('converts a Draft with only its final scheduling choices', async () => {
    postApiV1AppointmentRequestsByIdConvert.mockResolvedValue({
      data: { appointmentId: 'appointment-1', clientId: 'client-1' },
    })
    const { result } = renderHook(() => useConvertDraftMutation(), { wrapper })
    const body = {
      finalDate: '2026-07-25',
      startTime: '13:30',
      staffId: 'staff-1',
    }

    await result.current.mutateAsync({ requestId: 'draft-1', body })

    expect(postApiV1AppointmentRequestsByIdConvert).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'draft-1' }, body }),
    )
  })
})
