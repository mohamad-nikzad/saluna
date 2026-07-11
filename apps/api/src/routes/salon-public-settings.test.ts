import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/public', () => ({
  getManagerPublicSettings: vi.fn(),
  updateManagerPublicSettings: vi.fn(),
  updateSalonSlug: vi.fn(),
  getPublicSalon: vi.fn(),
  getPublicAvailability: vi.fn(),
  createAppointmentRequest: vi.fn(),
  getAppointmentRequestByToken: vi.fn(),
  cancelAppointmentRequestByToken: vi.fn(),
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

import * as pub from '@repo/database/public'
import { auth as authServer } from '@repo/auth/server'
import {
  getManagerMemberForUser,
  getMemberForUser,
} from '@repo/database/members'
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
  vi.mocked(authServer.api.getSession).mockImplementation(
    async (args: any) =>
      (args?.headers?.get?.('Authorization')
        ? { user: { id: 'u1' } }
        : null) as never,
  )
  vi.mocked(getMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId: 'u1',
    organizationId: 's1',
    role: 'owner',
    name: 'Manager',
    username: '09120000000',
  } as never)
})

describe('salon-public-settings router', () => {
  it('401 without auth on GET', async () => {
    const res = await app.request('/api/v1/salon-public-settings')
    expect(res.status).toBe(401)
  })

  it('403 on GET for staff', async () => {
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

  it('manager PUT accepts the onboarding { enabled, bioText } partial', async () => {
    vi.mocked(pub.updateManagerPublicSettings).mockResolvedValue(
      sampleResult as never,
    )
    const res = await app.request('/api/v1/salon-public-settings', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, bioText: 'درباره ما' }),
    })
    expect(res.status).toBe(200)
    expect(pub.updateManagerPublicSettings).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ enabled: true, bioText: 'درباره ما' }),
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

  it('403 on PATCH /slug for staff', async () => {
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
    const res = await app.request('/api/v1/salon-public-settings/slug', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'new-salon' }),
    })
    expect(res.status).toBe(403)
  })

  it('manager PATCH /slug updates slug and returns refreshed settings', async () => {
    const updated = { ...sampleResult, slug: 'new-salon' }
    vi.mocked(pub.updateSalonSlug).mockResolvedValue({
      ok: true,
      result: updated as never,
    })
    const res = await app.request('/api/v1/salon-public-settings/slug', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'new-salon' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
    expect(pub.updateSalonSlug).toHaveBeenCalledWith('s1', 'new-salon')
  })

  it('manager PATCH /slug returns 409 on conflict', async () => {
    vi.mocked(pub.updateSalonSlug).mockResolvedValue({
      ok: false,
      reason: 'conflict',
    })
    const res = await app.request('/api/v1/salon-public-settings/slug', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'taken-slug' }),
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('این آدرس سالن قبلاً ثبت شده است')
  })

  it('400 when slug format is invalid', async () => {
    const res = await app.request('/api/v1/salon-public-settings/slug', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'Bad Slug!' }),
    })
    expect(res.status).toBe(400)
  })
})
