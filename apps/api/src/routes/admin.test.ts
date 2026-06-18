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
  createAdminAuditEvent,
  createAdminCatalogPreset,
  createAdminInternalNote,
  getAdminSalon,
  getPlatformAdminForUser,
  getPlatformAdminMe,
  listAdminCatalogPresets,
  listAdminInternalNotes,
  listAdminSalons,
  updateAdminCatalogPreset,
  updateAdminSalonStatus,
} from '@repo/database/admin'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.ADMIN_DATA_SOURCE = 'live'

const { app } = await import('../app')

const authHeaders = { Authorization: 'Bearer testtoken' }
const salonId = '11111111-1111-4111-8111-111111111111'
const presetId = '22222222-2222-4222-8222-222222222222'
const presetTree = [
  {
    name: 'مو',
    families: [
      {
        name: 'رنگ',
        variants: [
          {
            name: 'رنگ ریشه',
            duration: 30,
            price: 500000,
            color: 'teal',
            description: null,
          },
        ],
      },
    ],
  },
]
const parsedPresetTree = [
  {
    name: 'مو',
    families: [
      {
        name: 'رنگ',
        variants: [
          {
            name: 'رنگ ریشه',
            duration: 30,
            price: 500000,
            color: 'rose',
            description: undefined,
          },
        ],
      },
    ],
  },
]

beforeEach(() => {
  vi.resetAllMocks()
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

  it('lists and reads admin salons', async () => {
    vi.mocked(listAdminSalons).mockResolvedValue({
      items: [{ id: salonId, name: 'Aftab', status: 'active' }],
      pagination: { page: 1, pageSize: 20, total: 1 },
    } as never)
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, name: 'Aftab', status: 'active' },
      members: [],
      stats: { services: 0, appointments: 0 },
    } as never)

    const listRes = await app.request(
      '/api/v1/admin/salons?page=1&pageSize=20&search=Aftab',
      { headers: authHeaders },
    )
    const detailRes = await app.request(`/api/v1/admin/salons/${salonId}`, {
      headers: authHeaders,
    })

    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toMatchObject({
      items: [{ id: salonId, name: 'Aftab' }],
      pagination: { total: 1 },
    })
    expect(listAdminSalons).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: 'Aftab',
    })
    expect(detailRes.status).toBe(200)
    expect(await detailRes.json()).toMatchObject({
      salon: { id: salonId, name: 'Aftab' },
    })
  })

  it('updates salon status with reason and LIVE confirmation', async () => {
    vi.mocked(updateAdminSalonStatus).mockResolvedValue({
      id: salonId,
      status: 'suspended',
    } as never)
    vi.mocked(createAdminAuditEvent).mockResolvedValue({
      id: 'audit-1',
    } as never)

    const res = await app.request(`/api/v1/admin/salons/${salonId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'suspended',
        reason: 'Safety review',
        liveConfirmation: 'LIVE',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      salon: { id: salonId, status: 'suspended' },
    })
    expect(updateAdminSalonStatus).toHaveBeenCalledWith({
      salonId,
      status: 'suspended',
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'salon.status.update',
        targetId: salonId,
        reason: 'Safety review',
      }),
    )
  })

  it('lists and creates internal salon notes with a reason', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, name: 'Aftab', status: 'active' },
      members: [],
      stats: { services: 0, appointments: 0 },
    } as never)
    vi.mocked(listAdminInternalNotes).mockResolvedValue([
      {
        id: 'note-1',
        subjectType: 'salon',
        subjectId: salonId,
        body: 'Existing note',
        authorUserId: 'admin-user-1',
        authorName: 'Admin',
        createdAt: new Date('2026-06-18T10:30:00.000Z'),
      },
    ] as never)
    vi.mocked(createAdminInternalNote).mockResolvedValue({
      id: 'note-2',
      subjectType: 'salon',
      subjectId: salonId,
      body: 'Follow up',
      authorUserId: 'admin-user-1',
      authorName: 'Admin',
      createdAt: new Date('2026-06-18T10:35:00.000Z'),
    } as never)
    vi.mocked(createAdminAuditEvent).mockResolvedValue({
      id: 'audit-2',
    } as never)

    const listRes = await app.request(`/api/v1/admin/salons/${salonId}/notes`, {
      headers: authHeaders,
    })
    const createRes = await app.request(
      `/api/v1/admin/salons/${salonId}/notes`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Follow up',
          reason: 'Support context',
        }),
      },
    )

    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toMatchObject({
      notes: [{ id: 'note-1', body: 'Existing note' }],
    })
    expect(listAdminInternalNotes).toHaveBeenCalledWith({
      subjectType: 'salon',
      subjectId: salonId,
    })
    expect(createRes.status).toBe(201)
    expect(await createRes.json()).toMatchObject({
      note: { id: 'note-2', body: 'Follow up' },
    })
    expect(createAdminInternalNote).toHaveBeenCalledWith({
      subjectType: 'salon',
      subjectId: salonId,
      body: 'Follow up',
      authorUserId: 'admin-user-1',
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'salon.note.create',
        targetId: salonId,
        reason: 'Support context',
      }),
    )
  })

  it('does not create internal salon notes for a missing salon', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue(undefined)

    const res = await app.request(`/api/v1/admin/salons/${salonId}/notes`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Follow up',
        reason: 'Support context',
      }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'سالن یافت نشد' })
    expect(createAdminInternalNote).not.toHaveBeenCalled()
    expect(createAdminAuditEvent).not.toHaveBeenCalled()
  })

  it('lists admin CatalogPreset records', async () => {
    vi.mocked(listAdminCatalogPresets).mockResolvedValue({
      items: [
        {
          id: presetId,
          slug: 'hair-services',
          name: 'قالب خدمات مو',
          tree: presetTree,
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    } as never)

    const res = await app.request(
      '/api/v1/admin/catalog-presets?page=1&pageSize=20&search=hair',
      { headers: authHeaders },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      items: [{ id: presetId, slug: 'hair-services' }],
      pagination: { total: 1 },
    })
    expect(listAdminCatalogPresets).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: 'hair',
    })
  })

  it('creates a CatalogPreset with a reason and writes audit event', async () => {
    vi.mocked(createAdminCatalogPreset).mockResolvedValue({
      id: presetId,
      slug: 'hair-services',
      name: 'قالب خدمات مو',
      tree: presetTree,
    } as never)
    vi.mocked(createAdminAuditEvent).mockResolvedValue({
      id: 'audit-catalog-create',
    } as never)

    const res = await app.request('/api/v1/admin/catalog-presets', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'hair-services',
        name: 'قالب خدمات مو',
        description: null,
        tree: presetTree,
        sortOrder: 1,
        isActive: true,
        reason: 'Add canonical hair service variants',
      }),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      preset: { id: presetId, slug: 'hair-services' },
    })
    expect(createAdminCatalogPreset).toHaveBeenCalledWith({
      slug: 'hair-services',
      name: 'قالب خدمات مو',
      description: null,
      tree: parsedPresetTree,
      sortOrder: 1,
      isActive: true,
      reason: 'Add canonical hair service variants',
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog_preset.create',
        targetType: 'catalog_preset',
        targetId: presetId,
        reason: 'Add canonical hair service variants',
      }),
    )
  })

  it('updates a CatalogPreset with a reason and writes audit event', async () => {
    vi.mocked(updateAdminCatalogPreset).mockResolvedValue({
      id: presetId,
      slug: 'hair-services',
      name: 'قالب خدمات مو و ابرو',
      tree: presetTree,
      isActive: false,
    } as never)
    vi.mocked(createAdminAuditEvent).mockResolvedValue({
      id: 'audit-catalog-update',
    } as never)

    const res = await app.request(
      `/api/v1/admin/catalog-presets/${presetId}`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'قالب خدمات مو و ابرو',
          isActive: false,
          reason: 'Archive old service variant language',
        }),
      },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      preset: { id: presetId, name: 'قالب خدمات مو و ابرو' },
    })
    expect(updateAdminCatalogPreset).toHaveBeenCalledWith({
      id: presetId,
      name: 'قالب خدمات مو و ابرو',
      isActive: false,
      reason: 'Archive old service variant language',
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog_preset.update',
        targetType: 'catalog_preset',
        targetId: presetId,
        reason: 'Archive old service variant language',
      }),
    )
  })
})
