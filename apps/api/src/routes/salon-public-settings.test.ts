import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/public', () => ({
  getManagerPublicSettings: vi.fn(),
  updateManagerPublicSettings: vi.fn(),
  getPublicSalon: vi.fn(),
  getPublicAvailability: vi.fn(),
  createAppointmentRequest: vi.fn(),
  getAppointmentRequestByToken: vi.fn(),
  cancelAppointmentRequestByToken: vi.fn(),
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as pub from '@repo/database/public'
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

const sampleResult = {
  slug: 'salon-x',
  salonName: 'Salon X',
  settings: {
    enabled: true,
    bioText: null,
    themeId: 'classic',
    layoutId: 'grid',
    appointmentRequestsEnabled: true,
  },
  services: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySession).mockResolvedValue('u1')
  vi.mocked(getUserById).mockResolvedValue(managerUser as never)
})

describe('salon-public-settings router', () => {
  it('401 without auth on GET', async () => {
    const res = await app.request('/api/v1/salon-public-settings')
    expect(res.status).toBe(401)
  })

  it('403 on GET for staff', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/salon-public-settings', {
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('manager GET returns manager public settings result', async () => {
    vi.mocked(pub.getManagerPublicSettings).mockResolvedValue(
      sampleResult as never,
    )
    const res = await app.request('/api/v1/salon-public-settings', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleResult)
    expect(pub.getManagerPublicSettings).toHaveBeenCalledWith('s1')
  })

  it('403 on PUT for staff', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/salon-public-settings', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
    expect(res.status).toBe(403)
  })

  it('manager PUT updates settings', async () => {
    vi.mocked(pub.updateManagerPublicSettings).mockResolvedValue(
      sampleResult as never,
    )
    const payload = {
      enabled: true,
      appointmentRequestsEnabled: false,
      bioText: 'سلام',
      services: [{ serviceId: 'svc1', visible: true }],
    }
    const res = await app.request('/api/v1/salon-public-settings', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleResult)
    expect(pub.updateManagerPublicSettings).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        enabled: true,
        appointmentRequestsEnabled: false,
        bioText: 'سلام',
      }),
    )
  })

  it('400 when bioText too long', async () => {
    const res = await app.request('/api/v1/salon-public-settings', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bioText: 'x'.repeat(500) }),
    })
    expect(res.status).toBe(400)
  })
})
