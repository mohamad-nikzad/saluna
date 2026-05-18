import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/dashboard', () => ({
  getDashboardData: vi.fn(),
  getTodayData: vi.fn(),
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

describe('dashboard router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/dashboard')
    expect(res.status).toBe(401)
  })

  it('403 for staff', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/dashboard', { headers: authHeaders })
    expect(res.status).toBe(403)
  })

  it('GET returns dashboard data', async () => {
    const payload = { kpis: { revenue: 100 }, charts: [] }
    vi.mocked(dashboardDb.getDashboardData).mockResolvedValue(payload as never)
    const res = await app.request('/api/v1/dashboard', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
    expect(dashboardDb.getDashboardData).toHaveBeenCalledWith('s1')
  })
})
