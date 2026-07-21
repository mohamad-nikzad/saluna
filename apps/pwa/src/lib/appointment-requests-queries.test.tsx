// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  appointmentRequestsListQueryOptions,
  getApiV1AppointmentRequestsQueryKey,
} from '#/lib/appointment-requests-queries'

const getApiV1AppointmentRequests = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1AppointmentRequests: (...args: unknown[]) =>
    getApiV1AppointmentRequests(...args),
}))

beforeEach(() => {
  getApiV1AppointmentRequests.mockReset()
})

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
})
