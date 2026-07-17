// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  appointmentsRangeInvalidationKeys,
  appointmentsRangeQueryOptions,
  getApiV1AppointmentsQueryKey,
} from '#/lib/appointments-queries'

const getApiV1Appointments = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Appointments: (...args: unknown[]) => getApiV1Appointments(...args),
  getApiV1AppointmentsAvailability: vi.fn(),
}))

beforeEach(() => {
  getApiV1Appointments.mockReset()
})

describe('appointments-queries', () => {
  it('exposes generated appointments list query keys', () => {
    expect(
      getApiV1AppointmentsQueryKey({
        query: { startDate: '2026-01-01', endDate: '2026-01-31' },
      })[0]._id,
    ).toBe('getApiV1Appointments')
  })

  it('invalidates commission reports when an appointment changes', () => {
    expect(
      appointmentsRangeInvalidationKeys().map((key) => key[0]?._id),
    ).toEqual([
      'getApiV1Appointments',
      'getApiV1Dashboard',
      'getApiV1CommissionsStaffByIdReport',
      'getApiV1CommissionsMe',
      'getApiV1CommissionsSalon',
    ])
  })

  it('selects appointments from the generated list response', async () => {
    getApiV1Appointments.mockResolvedValue({
      data: {
        appointments: [
          {
            id: 'apt-1',
            date: '2026-06-07',
            startTime: '10:00',
          },
        ],
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(
      appointmentsRangeQueryOptions('2026-01-01', '2026-01-31'),
    )

    expect(data).toEqual([
      {
        id: 'apt-1',
        date: '2026-06-07',
        startTime: '10:00',
      },
    ])
  })
})
