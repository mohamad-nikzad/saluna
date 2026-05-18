import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/dashboard', () => ({
  getDashboardData: vi.fn(),
  getTodayData: vi.fn(),
}))

vi.mock('@repo/salon-core/salon-local-time', () => ({
  salonTodayYmd: vi.fn(() => '2026-05-18'),
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as dashboardDb from '@repo/database/dashboard'
import { verifySession } from '@repo/auth/auth'
import { getUserById } from '@repo/database/auth-users'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const managerUser = {
  id: 'u1',
  salonId: 's1',
  role: 'manager' as const,
  name: 'Manager',
  phone: '09120000000',
  createdAt: new Date(),
}
const staffUser = { ...managerUser, id: 'u2', role: 'staff' as const }

const authHeaders = { Authorization: 'Bearer testtoken' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySession).mockResolvedValue('u1')
  vi.mocked(getUserById).mockResolvedValue(managerUser as never)
})

describe('today router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/today')
    expect(res.status).toBe(401)
  })

  it('manager GET defaults to today and no staff filter', async () => {
    const payload = { appointments: [] }
    vi.mocked(dashboardDb.getTodayData).mockResolvedValue(payload as never)
    const res = await app.request('/api/v1/today', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
    expect(dashboardDb.getTodayData).toHaveBeenCalledWith('s1', '2026-05-18', undefined)
  })

  it('respects ?date query param', async () => {
    vi.mocked(dashboardDb.getTodayData).mockResolvedValue({} as never)
    const res = await app.request('/api/v1/today?date=2026-01-01', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(dashboardDb.getTodayData).toHaveBeenCalledWith('s1', '2026-01-01', undefined)
  })

  it('staff role filters by their userId', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    vi.mocked(dashboardDb.getTodayData).mockResolvedValue({} as never)
    const res = await app.request('/api/v1/today', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(dashboardDb.getTodayData).toHaveBeenCalledWith('s1', '2026-05-18', 'u2')
  })
})
