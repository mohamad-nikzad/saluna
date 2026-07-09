import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/dashboard', () => ({
  getDashboardData: vi.fn(),
  getTodayData: vi.fn(),
}))

vi.mock('@repo/salon-core/salon-local-time', () => ({
  salonTodayYmd: vi.fn(() => '2026-05-18'),
}))

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
  getManagerMemberForUser: vi.fn(),
}))

import * as dashboardDb from '@repo/database/dashboard'
import { auth as authServer } from '@repo/auth/server'
import { getManagerMemberForUser, getMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

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
  vi.mocked(authServer.api.getSession).mockImplementation(async (args: any) => (args?.headers?.get?.('Authorization') ? { user: { id: 'u1' } } : null) as never)
  vi.mocked(getMemberForUser).mockResolvedValue({ userId: 'u1', organizationId: 's1', role: 'owner', name: 'Manager', username: '09120000000' } as never)
  vi.mocked(getManagerMemberForUser).mockResolvedValue({ userId: 'u1', organizationId: 's1', role: 'owner', name: 'Manager', username: '09120000000' } as never)
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

  it('staff role filters by linked Staff Profile and user id', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09120000001',
      salonStatus: 'active',
    } as never)
    vi.mocked(dashboardDb.getTodayData).mockResolvedValue({} as never)
    const res = await app.request('/api/v1/today', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(dashboardDb.getTodayData).toHaveBeenCalledWith('s1', '2026-05-18', ['u2', 'profile-u2'])
  })
})
