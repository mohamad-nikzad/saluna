import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/salon-profile', () => ({
  getSalonPresence: vi.fn(),
  updateSalonPresence: vi.fn(),
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

import * as db from '@repo/database/salon-profile'
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

const authHeaders = { Authorization: 'Bearer testtoken' }

const emptyPresence = {
  address: null,
  mapGoogle: null,
  mapNeshan: null,
  mapBalad: null,
  socialInstagram: null,
  socialTelegram: null,
  socialWhatsapp: null,
  website: null,
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

describe('salon-profile router', () => {
  it('401 without auth on GET presence', async () => {
    const res = await app.request('/api/v1/salon-profile/presence')
    expect(res.status).toBe(401)
  })

  it('403 on GET presence for staff', async () => {
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
    const res = await app.request('/api/v1/salon-profile/presence', {
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('manager GET returns presence', async () => {
    vi.mocked(db.getSalonPresence).mockResolvedValue(emptyPresence as never)
    const res = await app.request('/api/v1/salon-profile/presence', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ presence: emptyPresence })
    expect(db.getSalonPresence).toHaveBeenCalledWith('s1')
  })

  it('403 on PATCH presence for staff', async () => {
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
    const res = await app.request('/api/v1/salon-profile/presence', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'خیابان ولیعصر' }),
    })
    expect(res.status).toBe(403)
  })

  it('manager PATCH with a single field sends only that key', async () => {
    vi.mocked(db.updateSalonPresence).mockResolvedValue({
      ...emptyPresence,
      address: 'خیابان ولیعصر',
    } as never)
    const res = await app.request('/api/v1/salon-profile/presence', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: 'خیابان ولیعصر' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateSalonPresence).toHaveBeenCalledWith('s1', {
      address: 'خیابان ولیعصر',
    })
  })

  it('manager PATCH persists presence fields', async () => {
    vi.mocked(db.updateSalonPresence).mockResolvedValue({
      ...emptyPresence,
      address: 'خیابان ولیعصر',
      socialInstagram: '@saluna',
      socialWhatsapp: '09121234567',
      website: 'https://saluna.ir',
    } as never)
    const payload = {
      address: 'خیابان ولیعصر',
      mapGoogle: 'https://maps.app.goo.gl/abc',
      socialInstagram: '@saluna',
      socialWhatsapp: '09121234567',
      website: 'https://saluna.ir',
    }
    const res = await app.request('/api/v1/salon-profile/presence', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(200)
    expect(db.updateSalonPresence).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        address: 'خیابان ولیعصر',
        mapGoogle: 'https://maps.app.goo.gl/abc',
        socialInstagram: '@saluna',
        socialWhatsapp: '09121234567',
        website: 'https://saluna.ir',
      }),
    )
  })

  it('400 on invalid map URL (wrong domain)', async () => {
    const res = await app.request('/api/v1/salon-profile/presence', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapGoogle: 'https://example.com/x' }),
    })
    expect(res.status).toBe(400)
  })

  it('400 on non-HTTPS website', async () => {
    const res = await app.request('/api/v1/salon-profile/presence', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ website: 'http://saluna.ir' }),
    })
    expect(res.status).toBe(400)
  })
})
