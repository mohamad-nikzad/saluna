import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/commissions', () => ({
  disableCommissionAgreement: vi.fn(),
  getSalonCommissionReport: vi.fn(),
  getStaffCommissionReport: vi.fn(),
  setCommissionAgreement: vi.fn(),
}))
vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock('@repo/database/members', () => ({
  getManagerMemberForUser: vi.fn(),
}))
vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
}))

import * as commissionsDb from '@repo/database/commissions'
import { auth as authServer } from '@repo/auth/server'
import { getManagerMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')
const headers = { Authorization: 'Bearer testtoken' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authServer.api.getSession).mockResolvedValue({
    user: { id: 'manager-1' },
  } as never)
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId: 'manager-1',
    organizationId: 'salon-1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
})

function useStaffSession() {
  vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
  vi.mocked(resolveStaffTenantContext).mockResolvedValue({
    status: 'ok',
    userId: 'staff-user-1',
    salonId: 'salon-1',
    staffProfileId: 'profile-1',
    name: 'Staff',
    phone: '09120000001',
    salonStatus: 'active',
  } as never)
}

describe('Staff Commission routes', () => {
  it('lets a manager activate a validated percentage for a tenant Staff Profile', async () => {
    vi.mocked(commissionsDb.setCommissionAgreement).mockResolvedValue({
      staffProfileId: 'profile-1',
      percentage: 12.34,
      active: true,
      activatedAt: new Date('2026-07-18T00:00:00Z'),
      disabledAt: null,
    })
    const response = await app.request(
      '/api/v1/commissions/staff/profile-1/agreement',
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: 12.34 }),
      },
    )
    expect(response.status).toBe(200)
    expect(commissionsDb.setCommissionAgreement).toHaveBeenCalledWith({
      salonId: 'salon-1',
      staffRef: 'profile-1',
      percentageBasisPoints: 1234,
    })
  })

  it.each([0, 100.01, 12.345])(
    'rejects invalid percentage %s',
    async (percentage) => {
      const response = await app.request(
        '/api/v1/commissions/staff/profile-1/agreement',
        {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ percentage }),
        },
      )
      expect(response.status).toBe(400)
    },
  )

  it('prevents staff from writing agreements or reading salon-wide figures', async () => {
    useStaffSession()
    const write = await app.request(
      '/api/v1/commissions/staff/profile-1/agreement',
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: 20 }),
      },
    )
    const salon = await app.request('/api/v1/commissions/salon?period=today', {
      headers,
    })
    expect(write.status).toBe(403)
    expect(salon.status).toBe(403)
  })

  it('derives the private staff report from active Staff Profile Access', async () => {
    useStaffSession()
    vi.mocked(commissionsDb.getStaffCommissionReport).mockResolvedValue({
      staffProfileId: 'profile-1',
      rows: [],
    } as never)
    const response = await app.request(
      '/api/v1/commissions/me?period=custom&startDate=2026-07-01&endDate=2026-07-31',
      { headers },
    )
    expect(response.status).toBe(200)
    expect(commissionsDb.getStaffCommissionReport).toHaveBeenCalledWith({
      salonId: 'salon-1',
      staffRef: 'profile-1',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    })
  })

  it('returns 404 instead of leaking a cross-salon Staff Profile', async () => {
    vi.mocked(commissionsDb.getStaffCommissionReport).mockResolvedValue(null)
    const response = await app.request(
      '/api/v1/commissions/staff/other-salon-profile/report?period=today',
      { headers },
    )
    expect(response.status).toBe(404)
  })
})
