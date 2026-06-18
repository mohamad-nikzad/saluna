import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
    handler: vi.fn(),
  },
}))

vi.mock('@repo/database/admin', () => ({
  bootstrapPlatformOwnerIfNeeded: vi.fn(),
  countActivePlatformOwners: vi.fn(),
  createAdminAuditEvent: vi.fn(),
  createAdminCatalogPreset: vi.fn(),
  createAdminInternalNote: vi.fn(),
  getAdminMessagingHealth: vi.fn(),
  getAdminOverview: vi.fn(),
  getAdminSalon: vi.fn(),
  getAdminUser: vi.fn(),
  getPlatformAdminById: vi.fn(),
  getPlatformAdminForUser: vi.fn(),
  getPlatformAdminMe: vi.fn(),
  getUserPhoneForPlatformBootstrap: vi.fn(),
  listAdminAuditLog: vi.fn(),
  listAdminCatalogPresets: vi.fn(),
  listAdminInternalNotes: vi.fn(),
  listAdminNotificationDeliveries: vi.fn(),
  listAdminSalons: vi.fn(),
  listAdminSupportAppointmentRequests: vi.fn(),
  listAdminSupportAppointments: vi.fn(),
  listAdminUsers: vi.fn(),
  listPlatformAdmins: vi.fn(),
  updateAdminCatalogPreset: vi.fn(),
  updateAdminSalonStatus: vi.fn(),
  updatePlatformAdmin: vi.fn(),
  upsertPlatformAdmin: vi.fn(),
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
}))

import { auth as authServer } from '@repo/auth/server'
import {
  getPlatformAdminForUser,
  getPlatformAdminMe,
  updateAdminSalonStatus,
} from '@repo/database/admin'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.ADMIN_DATA_SOURCE = 'live'

const { app } = await import('../app')

const authHeaders = { Authorization: 'Bearer testtoken' }
const salonId = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authServer.api.getSession).mockResolvedValue({
    user: { id: 'admin-user-1' },
  } as never)
  vi.mocked(getPlatformAdminForUser).mockResolvedValue({
    id: 'platform-admin-1',
    userId: 'admin-user-1',
    role: 'platform_owner',
    active: true,
  } as never)
  vi.mocked(getPlatformAdminMe).mockResolvedValue({
    userId: 'admin-user-1',
    name: 'Admin',
    email: 'admin@example.com',
    phoneNumber: null,
    username: null,
    role: 'platform_owner',
    active: true,
  } as never)
})

describe('admin runtime data source', () => {
  it('exposes live data source through admin auth me', async () => {
    const res = await app.request('/api/v1/admin/auth/me', {
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      runtime: { dataSource: 'live' },
    })
  })

  it('blocks live salon status mutations without LIVE confirmation', async () => {
    const res = await app.request(`/api/v1/admin/salons/${salonId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended', reason: 'Safety review' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'برای تغییر داده زنده عبارت LIVE را وارد کنید',
    })
    expect(updateAdminSalonStatus).not.toHaveBeenCalled()
  })
})
