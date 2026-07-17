// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  getApiV1DashboardQueryKey,
  dashboardQueryOptions,
} from '#/lib/dashboard-queries'

const getApiV1Dashboard = vi.fn()
const dashboardData = {
  totalClients: 12,
  totalStaff: 3,
  todayAppointments: 4,
  weekAppointments: 10,
  monthAppointments: 40,
  todayStatusBreakdown: [],
  monthStatusBreakdown: [],
  popularServices: [],
  staffLoad: [],
  monthRevenue: 500000,
  monthSalonRetainedAmount: 400000,
  newClientsThisMonth: 2,
}

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Dashboard: (...args: unknown[]) => getApiV1Dashboard(...args),
}))

beforeEach(() => {
  getApiV1Dashboard.mockReset()
})

describe('dashboard-queries', () => {
  it('exposes generated dashboard query keys', () => {
    expect(getApiV1DashboardQueryKey()[0]._id).toBe('getApiV1Dashboard')
  })

  it('maps dashboard metrics from the generated response', async () => {
    getApiV1Dashboard.mockResolvedValue({ data: dashboardData })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(dashboardQueryOptions())

    expect(data.totalClients).toBe(12)
    expect(data.monthRevenue).toBe(500000)
    expect(data.monthSalonRetainedAmount).toBe(400000)
  })

  it('bypasses dashboard data cached before the financial summary existed', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(getApiV1DashboardQueryKey(), {
      ...dashboardData,
      monthSalonRetainedAmount: undefined,
    })
    getApiV1Dashboard.mockResolvedValue({ data: dashboardData })

    const data = await queryClient.fetchQuery(dashboardQueryOptions())

    expect(getApiV1Dashboard).toHaveBeenCalledOnce()
    expect(data.monthSalonRetainedAmount).toBe(400000)
  })
})
