import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/commissions', () => ({
  getSalonMoneyReport: vi.fn(),
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

const emptyReport = {
  startDate: '2026-06-22',
  endDate: '2026-07-22',
  summary: {
    bookedTotal: 0,
    staffCommissionTotal: 0,
    salonRetainedAmount: 0,
  },
  staff: [],
  appointments: [],
}

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

describe('Salon money report routes', () => {
  it('lets a manager fetch the current Jalali Month by default', async () => {
    vi.mocked(commissionsDb.getSalonMoneyReport).mockResolvedValue({
      ok: true,
      report: emptyReport,
    })
    const response = await app.request('/api/v1/reports/salon-money', {
      headers,
    })
    expect(response.status).toBe(200)
    expect(commissionsDb.getSalonMoneyReport).toHaveBeenCalledWith({
      salonId: 'salon-1',
      startDate: expect.any(String),
      endDate: expect.any(String),
    })
    const body = await response.json()
    expect(body.report.summary.bookedTotal).toBe(0)
  })

  it('accepts previousMonth and combined filters', async () => {
    vi.mocked(commissionsDb.getSalonMoneyReport).mockResolvedValue({
      ok: true,
      report: emptyReport,
    })
    const response = await app.request(
      '/api/v1/reports/salon-money?period=previousMonth&staffProfileId=profile-1&serviceId=service-1&categoryId=category-1',
      { headers },
    )
    expect(response.status).toBe(200)
    expect(commissionsDb.getSalonMoneyReport).toHaveBeenCalledWith({
      salonId: 'salon-1',
      staffProfileId: 'profile-1',
      serviceId: 'service-1',
      categoryId: 'category-1',
      startDate: expect.any(String),
      endDate: expect.any(String),
    })
  })

  it('rejects an invalid custom range', async () => {
    const response = await app.request(
      '/api/v1/reports/salon-money?period=custom&startDate=2026-07-31&endDate=2026-07-01',
      { headers },
    )
    expect(response.status).toBe(400)
    expect(commissionsDb.getSalonMoneyReport).not.toHaveBeenCalled()
  })

  it('maps unknown staff, service, and category to 404', async () => {
    vi.mocked(commissionsDb.getSalonMoneyReport)
      .mockResolvedValueOnce({ ok: false, reason: 'staff' })
      .mockResolvedValueOnce({ ok: false, reason: 'service' })
      .mockResolvedValueOnce({ ok: false, reason: 'category' })

    const staff = await app.request(
      '/api/v1/reports/salon-money?staffProfileId=missing',
      { headers },
    )
    const service = await app.request(
      '/api/v1/reports/salon-money?serviceId=missing',
      { headers },
    )
    const category = await app.request(
      '/api/v1/reports/salon-money?categoryId=missing',
      { headers },
    )
    expect(staff.status).toBe(404)
    expect(service.status).toBe(404)
    expect(category.status).toBe(404)
  })

  it('prevents staff from reading the salon money report', async () => {
    useStaffSession()
    const response = await app.request('/api/v1/reports/salon-money', {
      headers,
    })
    expect(response.status).toBe(403)
    expect(commissionsDb.getSalonMoneyReport).not.toHaveBeenCalled()
  })
})
