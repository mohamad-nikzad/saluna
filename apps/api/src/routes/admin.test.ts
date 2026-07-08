import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/auth/server', () => {
  const auth = {
    api: {
      getSession: vi.fn(),
    },
    handler: vi.fn(),
  }
  return { auth, adminAuth: auth, getAuthForRequest: () => auth }
})

vi.mock('@repo/database/admin', () => ({
  bootstrapPlatformOwnerIfNeeded: vi.fn(),
  countActivePlatformOwners: vi.fn(),
  createAdminAuditEvent: vi.fn(),
  createAdminCatalogPreset: vi.fn(),
  createAdminInternalNote: vi.fn(),
  createSetupSalon: vi.fn(),
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
  listAdminSalonAppointmentRequests: vi.fn(),
  listAdminSalonAppointments: vi.fn(),
  listAdminSalonClients: vi.fn(),
  listAdminSalonServices: vi.fn(),
  listAdminSalonStaff: vi.fn(),
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

vi.mock('@repo/database/salon-handoff', () => ({
  createSalonHandoff: vi.fn(),
  getSalonIdentityConflictForPhone: vi.fn(),
  updateSetupSalonOwnerPhone: vi.fn(),
}))

vi.mock('@repo/database/settings', () => ({
  getBusinessSettings: vi.fn(),
  updateBusinessSettings: vi.fn(),
}))

vi.mock('@repo/database/salon-profile', () => ({
  getSalonPresence: vi.fn(),
  updateSalonPresence: vi.fn(),
}))

vi.mock('@repo/database/staff', () => ({
  createSetupStaffProfile: vi.fn(),
  getClaimedStaffAccessForPhone: vi.fn(),
  listSetupStaffProfiles: vi.fn(),
  validateActiveServiceIds: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  createClient: vi.fn(),
  createClientsBulk: vi.fn(),
  getAllClients: vi.fn(),
  isDuplicatePhoneError: (error: unknown) =>
    error instanceof Error && error.message.includes('duplicate'),
  setClientTags: vi.fn(),
}))

vi.mock('@repo/database/catalog-presets', () => ({
  applyCatalogPreset: vi.fn(),
  listActiveCatalogPresets: vi.fn(),
}))

vi.mock('@repo/database/services', () => ({
  CatalogReferenceError: class CatalogReferenceError extends Error {},
  createService: vi.fn(),
  createServiceAddon: vi.fn(),
  createServiceCategory: vi.fn(),
  createServiceFamily: vi.fn(),
  getAllServiceAddons: vi.fn(),
  getAllServiceCategories: vi.fn(),
  getAllServiceFamilies: vi.fn(),
  getAllServicePackages: vi.fn(),
  getAllServices: vi.fn(),
  updateService: vi.fn(),
  updateServiceAddon: vi.fn(),
  updateServiceCategory: vi.fn(),
  updateServiceFamily: vi.fn(),
}))

import { auth as authServer } from '@repo/auth/server'
import {
  createAdminAuditEvent,
  createAdminCatalogPreset,
  createAdminInternalNote,
  createSetupSalon,
  getAdminSalon,
  getPlatformAdminForUser,
  getPlatformAdminMe,
  listPlatformAdmins,
  listAdminCatalogPresets,
  listAdminInternalNotes,
  listAdminSalonAppointmentRequests,
  listAdminSalonAppointments,
  listAdminSalonClients,
  listAdminSalonServices,
  listAdminSalonStaff,
  listAdminSalons,
  updateAdminCatalogPreset,
  updateAdminSalonStatus,
  updatePlatformAdmin,
  upsertPlatformAdmin,
} from '@repo/database/admin'
import {
  getBusinessSettings,
  updateBusinessSettings,
} from '@repo/database/settings'
import {
  getSalonPresence,
  updateSalonPresence,
} from '@repo/database/salon-profile'
import { applyCatalogPreset } from '@repo/database/catalog-presets'
import {
  createSetupStaffProfile,
  getClaimedStaffAccessForPhone,
  listSetupStaffProfiles,
  validateActiveServiceIds,
} from '@repo/database/staff'
import {
  createClient,
  createClientsBulk,
  getAllClients,
  setClientTags,
} from '@repo/database/clients'
import {
  createService,
  createServiceCategory,
  getAllServiceAddons,
  getAllServiceCategories,
  getAllServiceFamilies,
  getAllServicePackages,
  getAllServices,
  updateService,
} from '@repo/database/services'
import {
  createSalonHandoff,
  getSalonIdentityConflictForPhone,
  updateSetupSalonOwnerPhone,
} from '@repo/database/salon-handoff'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.ADMIN_DATA_SOURCE = 'live'

const { app } = await import('../app')

const authHeaders = { Authorization: 'Bearer testtoken' }
const salonId = '11111111-1111-4111-8111-111111111111'
const presetId = '22222222-2222-4222-8222-222222222222'
const platformAdminId = '33333333-3333-4333-8333-333333333333'
const platformAdminUserId = '44444444-4444-4444-8444-444444444444'
const presetTree = [
  {
    name: 'مو',
    services: [
      {
        name: 'رنگ ریشه',
        duration: 30,
        price: 500000,
        color: 'teal',
        description: null,
      },
    ],
  },
]
const parsedPresetTree = [
  {
    name: 'مو',
    services: [
      {
        name: 'رنگ ریشه',
        duration: 30,
        price: 500000,
        color: 'rose',
        description: undefined,
      },
    ],
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getSalonIdentityConflictForPhone).mockResolvedValue(undefined)
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

  it('updates live salon status without forced confirmation fields', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
      members: [],
      stats: {},
    } as never)
    vi.mocked(updateAdminSalonStatus).mockResolvedValue({
      id: salonId,
      status: 'suspended',
    } as never)

    const res = await app.request(`/api/v1/admin/salons/${salonId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'suspended' }),
    })

    expect(res.status).toBe(200)
    expect(updateAdminSalonStatus).toHaveBeenCalledWith({
      salonId,
      status: 'suspended',
    })
  })

  it('creates a Setup Salon with a canonical phone and redacted audit metadata', async () => {
    vi.mocked(createSetupSalon).mockResolvedValue({
      id: salonId,
      name: 'Aftab',
      slug: `setup-${salonId}`,
      status: 'setup',
      intendedOwnerPhone: '09121234567',
      publicEnabled: false,
      appointmentRequestsEnabled: false,
    } as never)

    const res = await app.request('/api/v1/admin/salons', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ' Aftab ',
        intendedOwnerPhone: '+98 912 123 4567',
      }),
    })

    expect(res.status).toBe(201)
    expect(createSetupSalon).toHaveBeenCalledWith({
      name: 'Aftab',
      intendedOwnerPhone: '09121234567',
    })
    expect(await res.json()).toMatchObject({ ownerConflict: null })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user-1',
        action: 'salon.setup.create',
        targetId: salonId,
        metadata: { intendedOwnerPhone: '[REDACTED]' },
      }),
    )
  })

  it('rejects invalid intended-owner phones', async () => {
    const res = await app.request('/api/v1/admin/salons', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aftab',
        intendedOwnerPhone: '12345',
      }),
    })

    expect(res.status).toBe(400)
    expect(createSetupSalon).not.toHaveBeenCalled()
  })

  it.each(['platform_support', 'platform_viewer'] as const)(
    'forbids Setup Salon creation for %s',
    async (role) => {
      vi.mocked(getPlatformAdminForUser).mockResolvedValue({
        id: 'platform-admin-2',
        userId: 'admin-user-1',
        role,
        active: true,
      } as never)

      const res = await app.request('/api/v1/admin/salons', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Aftab',
          intendedOwnerPhone: '09121234567',
        }),
      })

      expect(res.status).toBe(403)
      expect(createSetupSalon).not.toHaveBeenCalled()
    },
  )

  it('reads and updates Setup Salon hours using manager settings behavior', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: {
        id: salonId,
        status: 'setup',
        intendedOwnerPhone: '09121234567',
      },
      members: [],
      stats: {},
    } as never)
    vi.mocked(getBusinessSettings).mockResolvedValue({
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
      workingDays: 126,
    })
    vi.mocked(getSalonPresence).mockResolvedValue({
      address: null,
      mapGoogle: null,
      mapNeshan: null,
      mapBalad: null,
      socialInstagram: null,
      socialTelegram: null,
      socialWhatsapp: null,
      website: null,
    })
    vi.mocked(updateBusinessSettings).mockResolvedValue({
      workingStart: '10:00',
      workingEnd: '20:00',
      slotDurationMinutes: 30,
      workingDays: 62,
    })

    const readRes = await app.request(`/api/v1/admin/salons/${salonId}/setup`, {
      headers: authHeaders,
    })
    const updateRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/hours`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workingStart: '۱۰:۰۰',
          workingEnd: '۲۰:۰۰',
          workingDays: 62,
        }),
      },
    )

    expect(readRes.status).toBe(200)
    expect(await readRes.json()).toMatchObject({
      hours: { workingStart: '09:00', workingDays: 126 },
      presence: { address: null },
    })
    expect(updateRes.status).toBe(200)
    expect(updateBusinessSettings).toHaveBeenCalledWith(salonId, {
      workingStart: '10:00',
      workingEnd: '20:00',
      workingDays: 62,
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'salon.setup.hours.update',
      }),
    )
  })

  it('lets an active Platform Owner override active-salon operating data and audits the real actor', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
      members: [],
      stats: {},
    } as never)
    vi.mocked(getBusinessSettings).mockResolvedValue({
      workingStart: '09:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
      workingDays: 126,
    })
    vi.mocked(getSalonPresence).mockResolvedValue({
      address: null,
      mapGoogle: null,
      mapNeshan: null,
      mapBalad: null,
      socialInstagram: null,
      socialTelegram: null,
      socialWhatsapp: null,
      website: null,
    })
    vi.mocked(updateBusinessSettings).mockResolvedValue({
      workingStart: '10:00',
      workingEnd: '19:00',
      slotDurationMinutes: 30,
      workingDays: 126,
    })

    const readRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup?override=true`,
      { headers: authHeaders },
    )
    const updateRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/hours`,
      {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          'User-Agent': 'override-test',
          'X-Forwarded-For': '203.0.113.10',
          'X-Request-Id': 'override-request-1',
        },
        body: JSON.stringify({
          workingStart: '10:00',
          override: true,
        }),
      },
    )

    expect(readRes.status).toBe(200)
    expect(JSON.stringify(await readRes.json())).not.toMatch(
      /password|otp|session|credential|token|secret/i,
    )
    expect(updateRes.status).toBe(200)
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user-1',
        actorPlatformRole: 'platform_owner',
        action: 'salon.override.hours.update',
        salonId,
        targetId: salonId,
        metadata: { fields: ['workingStart'] },
        ip: '203.0.113.10',
        userAgent: 'override-test',
        requestId: 'override-request-1',
      }),
    )
  })

  it.each(['platform_admin', 'platform_support', 'platform_viewer'] as const)(
    'forbids active-salon override for %s',
    async (role) => {
      vi.mocked(getPlatformAdminForUser).mockResolvedValue({
        id: 'platform-admin-2',
        userId: 'admin-user-1',
        role,
        active: true,
      } as never)
      vi.mocked(getAdminSalon).mockResolvedValue({
        salon: { id: salonId, status: 'active' },
        members: [],
        stats: {},
      } as never)

      const res = await app.request(
        `/api/v1/admin/salons/${salonId}/setup/hours`,
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workingStart: '10:00',
            override: true,
          }),
        },
      )

      expect(res.status).toBe(403)
      expect(updateBusinessSettings).not.toHaveBeenCalled()
      expect(createAdminAuditEvent).not.toHaveBeenCalled()
    },
  )

  it('forbids override for an inactive Platform Owner', async () => {
    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'platform-owner-inactive',
      userId: 'admin-user-1',
      role: 'platform_owner',
      active: false,
    } as never)

    const res = await app.request(
      `/api/v1/admin/salons/${salonId}/setup?override=true`,
      { headers: authHeaders },
    )

    expect(res.status).toBe(403)
    expect(getBusinessSettings).not.toHaveBeenCalled()
  })

  it('requires override intent for active-salon changes', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
      members: [],
      stats: {},
    } as never)

    const requests = [
      {
        workingStart: '10:00',
      },
      { workingStart: '10:00', override: true },
      { workingStart: '10:00', override: true },
    ]
    const responses = await Promise.all(
      requests.map((body) =>
        app.request(`/api/v1/admin/salons/${salonId}/setup/hours`, {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      ),
    )

    expect(responses.map((response) => response.status)).toEqual([
      409, 200, 200,
    ])
    expect(updateBusinessSettings).toHaveBeenCalledTimes(2)
  })

  it('updates the intended-owner phone and creates an opaque handoff link', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: {
        id: salonId,
        status: 'setup',
        intendedOwnerPhone: '09121234567',
      },
      members: [],
      stats: {},
    } as never)
    vi.mocked(updateSetupSalonOwnerPhone).mockResolvedValue({
      salonId,
      intendedOwnerPhone: '09121234567',
    })
    vi.mocked(createSalonHandoff).mockResolvedValue({
      token: 'opaque-token-value',
      expiresAt: new Date('2026-06-24T12:00:00.000Z'),
    })
    vi.mocked(getSalonIdentityConflictForPhone).mockResolvedValue(undefined)

    const phoneRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/owner-phone`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intendedOwnerPhone: '۰۹۱۲۱۲۳۴۵۶۷',
        }),
      },
    )
    const linkRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/handoff`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enablePublicPage: true,
        }),
      },
    )

    expect(phoneRes.status).toBe(200)
    expect(updateSetupSalonOwnerPhone).toHaveBeenCalledWith({
      salonId,
      intendedOwnerPhone: '09121234567',
    })
    expect(linkRes.status).toBe(200)
    expect(await linkRes.json()).toMatchObject({
      url: 'http://localhost:3000/handoff/opaque-token-value',
    })
    expect(createSalonHandoff).toHaveBeenCalledWith({
      salonId,
      createdByUserId: 'admin-user-1',
      enablePublicPage: true,
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'salon.setup.owner_phone.update',
        metadata: { intendedOwnerPhone: '[REDACTED]' },
      }),
    )
  })

  it('warns on Setup Salon creation and blocks handoff for an owned phone', async () => {
    vi.mocked(createSetupSalon).mockResolvedValue({
      id: salonId,
      name: 'Aftab',
      status: 'setup',
    } as never)
    vi.mocked(getSalonIdentityConflictForPhone).mockResolvedValue({
      salonId: 'existing-salon',
      salonName: 'Mehr',
      salonStatus: 'active',
    })
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: {
        id: salonId,
        status: 'setup',
        intendedOwnerPhone: '09121234567',
      },
      members: [],
      stats: {},
    } as never)

    const createRes = await app.request('/api/v1/admin/salons', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aftab',
        intendedOwnerPhone: '09121234567',
      }),
    })
    const handoffRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/handoff`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )

    expect(createRes.status).toBe(201)
    expect(await createRes.json()).toMatchObject({
      ownerConflict: {
        salonName: 'Mehr',
        salonStatus: 'active',
      },
    })
    expect(handoffRes.status).toBe(409)
    expect(await handoffRes.json()).toMatchObject({
      code: 'HANDOFF_IDENTITY_CONFLICT',
    })
    expect(createSalonHandoff).not.toHaveBeenCalled()
  })

  it('normalizes Setup Salon presence with the manager schema', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'setup' },
      members: [],
      stats: {},
    } as never)
    vi.mocked(updateSalonPresence).mockResolvedValue({
      address: 'Tehran',
      mapGoogle: 'https://maps.app.goo.gl/abc',
      mapNeshan: null,
      mapBalad: null,
      socialInstagram: '@aftab',
      socialTelegram: null,
      socialWhatsapp: null,
      website: null,
    })

    const res = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/presence`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: '  Tehran  ',
          mapGoogle: ' https://maps.app.goo.gl/abc ',
          socialInstagram: ' @aftab ',
          website: '',
        }),
      },
    )

    expect(res.status).toBe(200)
    expect(updateSalonPresence).toHaveBeenCalledWith(salonId, {
      address: 'Tehran',
      mapGoogle: 'https://maps.app.goo.gl/abc',
      socialInstagram: '@aftab',
      website: undefined,
    })
  })

  it('creates and lists an unclaimed Staff Profile without credentials', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'setup' },
    } as never)
    vi.mocked(validateActiveServiceIds).mockResolvedValue(true)
    vi.mocked(createSetupStaffProfile).mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      salonId,
      userId: null,
      name: 'سارا',
      phone: '09121234567',
      color: 'mint',
      active: true,
    } as never)
    vi.mocked(listSetupStaffProfiles).mockResolvedValue([
      { id: '55555555-5555-4555-8555-555555555555', claimed: false },
    ] as never)

    const body = {
      name: 'سارا',
      phone: '09121234567',
      color: 'mint',
      active: true,
      serviceIds: ['66666666-6666-4666-8666-666666666666'],
      schedule: [
        {
          dayOfWeek: 0,
          active: true,
          workingStart: '09:00',
          workingEnd: '17:00',
        },
      ],
    }
    const createRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/staff`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    expect(createRes.status).toBe(201)
    expect(createSetupStaffProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId,
        name: 'سارا',
        phone: '09121234567',
        serviceIds: body.serviceIds,
      }),
    )
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'salon.setup.staff_profile.create',
        metadata: expect.objectContaining({ phone: '[REDACTED]' }),
      }),
    )

    const listRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/staff`,
      { headers: authHeaders },
    )
    expect(listRes.status).toBe(200)
    expect(await listRes.json()).toEqual({
      staff: [{ id: '55555555-5555-4555-8555-555555555555', claimed: false }],
    })
  })

  it('creates one Setup Salon Client with canonical validation and redacted audit data', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'setup' },
    } as never)
    vi.mocked(createClient).mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      salonId,
      name: 'مریم',
      phone: '09123456789',
    } as never)
    vi.mocked(setClientTags).mockResolvedValue([])

    const res = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/clients`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ' مریم ',
          phone: '۰۹۱۲۳۴۵۶۷۸۹',
          tags: [],
        }),
      },
    )

    expect(res.status).toBe(201)
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId,
        name: 'مریم',
        phone: '09123456789',
      }),
    )
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'salon.setup.client.create',
        metadata: { personalData: '[REDACTED]' },
      }),
    )
  })

  it.each([
    {
      format: 'csv',
      source:
        'name,phone,ignored\nAli,09121111111,x\nExisting,۰۹۱۲۲۲۲۲۲۲۲,x\nBad,123,x\nDuplicate,09121111111,x',
      selectedLocalId: 'csv-1',
    },
    {
      format: 'vcf',
      source:
        'BEGIN:VCARD\nFN:Ali\nTEL:09121111111\nEND:VCARD\nBEGIN:VCARD\nFN:Existing\nTEL:۰۹۱۲۲۲۲۲۲۲۲\nEND:VCARD\nBEGIN:VCARD\nFN:Bad\nTEL:123\nEND:VCARD\nBEGIN:VCARD\nFN:Duplicate\nTEL:09121111111\nEND:VCARD',
      selectedLocalId: 'vcf-1',
    },
  ])(
    'previews and confirms an ephemeral $format Client Import',
    async ({ format, source, selectedLocalId }) => {
      vi.mocked(getAdminSalon).mockResolvedValue({
        salon: { id: salonId, status: 'setup' },
      } as never)
      vi.mocked(getAllClients).mockResolvedValue([
        { id: 'existing', name: 'Existing', phone: '09122222222' },
      ] as never)
      vi.mocked(createClientsBulk).mockResolvedValue({
        created: [{ id: 'new-client', name: 'Ali', phone: '09121111111' }],
        skipped: [],
      } as never)

      const previewRes = await app.request(
        `/api/v1/admin/salons/${salonId}/setup/clients/import/preview`,
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ format, source }),
        },
      )
      expect(previewRes.status).toBe(200)
      expect(await previewRes.json()).toMatchObject({
        counts: {
          totalInFile: 4,
          eligible: 1,
          invalid: 1,
          duplicateExisting: 1,
          duplicateInFile: 1,
        },
        rows: [{ localId: selectedLocalId, phone: '09121111111' }],
      })

      const confirmRes = await app.request(
        `/api/v1/admin/salons/${salonId}/setup/clients/import`,
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            format,
            source,
            selectedLocalIds: [selectedLocalId],
          }),
        },
      )
      expect(confirmRes.status).toBe(200)
      expect(await confirmRes.json()).toEqual({
        imported: 1,
        skipped: 3,
        duplicate: 2,
        invalid: 1,
      })
      expect(createClientsBulk).toHaveBeenCalledWith(salonId, [
        { name: 'Ali', phone: '09121111111' },
      ])
      expect(createAdminAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'salon.setup.client_import.create',
          metadata: {
            format,
            imported: 1,
            skipped: 3,
            duplicate: 2,
            invalid: 1,
          },
        }),
      )
    },
  )

  it('forbids Client setup writes after handoff and for read-only platform roles', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
    } as never)
    const lifecycle = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/clients/import/preview`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv', source: 'Ali,09121111111' }),
      },
    )
    expect(lifecycle.status).toBe(409)

    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'platform-viewer',
      userId: platformAdminUserId,
      role: 'platform_viewer',
      active: true,
    } as never)
    const forbidden = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/clients/import/preview`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv', source: 'Ali,09121111111' }),
      },
    )
    expect(forbidden.status).toBe(403)
  })

  it('shows claimed cross-salon staff access only to salon-managing admins', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'setup' },
    } as never)
    vi.mocked(getClaimedStaffAccessForPhone).mockResolvedValue({
      salonId: '77777777-7777-4777-8777-777777777777',
      salonName: 'سالن قبلی',
      salonStatus: 'active',
    })

    const allowed = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/staff/access?phone=09121234567`,
      { headers: authHeaders },
    )
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toEqual({
      access: expect.objectContaining({
        salonName: 'سالن قبلی',
        salonStatus: 'active',
      }),
    })

    for (const role of ['platform_support', 'platform_viewer'] as const) {
      vi.mocked(getPlatformAdminForUser).mockResolvedValue({
        id: `platform-${role}`,
        userId: platformAdminUserId,
        role,
        active: true,
      } as never)
      const forbidden = await app.request(
        `/api/v1/admin/salons/${salonId}/setup/staff/access?phone=09121234567`,
        { headers: authHeaders },
      )
      expect(forbidden.status).toBe(403)
    }
    expect(getClaimedStaffAccessForPhone).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid setup validation, roles, and salon lifecycles', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
      members: [],
      stats: {},
    } as never)
    const lifecycleRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/hours`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workingStart: '09:00',
          workingEnd: '19:00',
        }),
      },
    )
    expect(lifecycleRes.status).toBe(409)

    const invalidRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/presence`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapGoogle: 'https://example.com/map',
        }),
      },
    )
    expect(invalidRes.status).toBe(400)

    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'platform-admin-2',
      userId: 'admin-user-1',
      role: 'platform_support',
      active: true,
    } as never)
    const forbiddenRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup`,
      { headers: authHeaders },
    )
    expect(forbiddenRes.status).toBe(403)
    expect(updateBusinessSettings).not.toHaveBeenCalled()
    expect(updateSalonPresence).not.toHaveBeenCalled()
  })

  it('applies a CatalogPreset and manually edits a Setup Salon catalog', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'setup' },
      members: [],
      stats: {},
    } as never)
    vi.mocked(getAllServiceCategories).mockResolvedValue([])
    vi.mocked(getAllServiceFamilies).mockResolvedValue([])
    vi.mocked(getAllServices).mockResolvedValue([])
    vi.mocked(getAllServiceAddons).mockResolvedValue([])
    vi.mocked(getAllServicePackages).mockResolvedValue([])
    vi.mocked(applyCatalogPreset).mockResolvedValue({
      importedCategoryIds: ['category-1'],
      importedVariantIds: ['service-1'],
    })
    vi.mocked(createServiceCategory).mockResolvedValue({
      id: 'category-1',
      name: 'مو',
      active: true,
    } as never)
    vi.mocked(createService).mockResolvedValue({ id: 'service-1' } as never)
    vi.mocked(updateService).mockResolvedValue({ id: 'service-1' } as never)

    const presetRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog/presets/${presetId}/apply`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selection: [
            {
              categoryIndex: 0,
              serviceIndices: [0],
            },
          ],
        }),
      },
    )
    const categoryRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog/categories`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'مو',
        }),
      },
    )
    const serviceRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog/services`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'رنگ مو',
          categoryId: 'category-1',
          duration: 60,
          price: 1200000,
          color: 'rose',
        }),
      },
    )
    const editRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog/services/service-1`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: 1400000,
        }),
      },
    )

    expect(presetRes.status).toBe(200)
    expect(categoryRes.status).toBe(201)
    expect(serviceRes.status).toBe(201)
    expect(editRes.status).toBe(200)
    expect(applyCatalogPreset).toHaveBeenCalledWith(
      expect.objectContaining({ salonId, presetId }),
    )
    expect(updateService).toHaveBeenCalledWith('service-1', salonId, {
      price: 1400000,
    })
  })

  it('rejects setup catalog validation, unauthorized roles, and active salons', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
      members: [],
      stats: {},
    } as never)
    const lifecycleRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog/categories`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'مو',
        }),
      },
    )
    expect(lifecycleRes.status).toBe(409)

    const validationRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog/services`,
      {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid',
          categoryId: '',
          duration: 0,
          price: -1,
          color: 'rose',
        }),
      },
    )
    expect(validationRes.status).toBe(400)

    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'platform-viewer-1',
      userId: 'admin-user-1',
      role: 'platform_viewer',
      active: true,
    } as never)
    const forbiddenRes = await app.request(
      `/api/v1/admin/salons/${salonId}/setup/catalog`,
      { headers: authHeaders },
    )
    expect(forbiddenRes.status).toBe(403)
    expect(createServiceCategory).not.toHaveBeenCalled()
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

  it('lists read-only salon tenant data tabs with pagination', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, name: 'Aftab', status: 'active' },
      members: [],
      stats: { services: 0, appointments: 0 },
    } as never)
    vi.mocked(listAdminSalonClients).mockResolvedValue({
      items: [{ id: 'client-1', name: 'Client One' }],
      pagination: { page: 1, pageSize: 20, total: 1 },
    } as never)
    vi.mocked(listAdminSalonAppointments).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    } as never)
    vi.mocked(listAdminSalonAppointmentRequests).mockResolvedValue({
      items: [{ id: 'request-1', customerName: 'Request One' }],
      pagination: { page: 1, pageSize: 20, total: 1 },
    } as never)
    vi.mocked(listAdminSalonStaff).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    } as never)
    vi.mocked(listAdminSalonServices).mockResolvedValue({
      items: [{ id: 'service-1', name: 'ServiceVariant One' }],
      pagination: { page: 1, pageSize: 20, total: 1 },
    } as never)

    const clientsRes = await app.request(
      `/api/v1/admin/salons/${salonId}/clients?page=1&pageSize=20&search=Client`,
      { headers: authHeaders },
    )
    const appointmentsRes = await app.request(
      `/api/v1/admin/salons/${salonId}/appointments?page=1&pageSize=20`,
      { headers: authHeaders },
    )
    const requestsRes = await app.request(
      `/api/v1/admin/salons/${salonId}/appointment-requests?page=1&pageSize=20`,
      { headers: authHeaders },
    )
    const staffRes = await app.request(
      `/api/v1/admin/salons/${salonId}/staff?page=1&pageSize=20`,
      { headers: authHeaders },
    )
    const servicesRes = await app.request(
      `/api/v1/admin/salons/${salonId}/services?page=1&pageSize=20`,
      { headers: authHeaders },
    )

    expect(clientsRes.status).toBe(200)
    expect(await clientsRes.json()).toMatchObject({
      items: [{ name: 'Client One' }],
      pagination: { total: 1 },
    })
    expect(await appointmentsRes.json()).toMatchObject({
      items: [],
      pagination: { total: 0 },
    })
    expect(await requestsRes.json()).toMatchObject({
      items: [{ customerName: 'Request One' }],
    })
    expect(await staffRes.json()).toMatchObject({
      items: [],
      pagination: { total: 0 },
    })
    expect(await servicesRes.json()).toMatchObject({
      items: [{ name: 'ServiceVariant One' }],
    })
    expect(listAdminSalonClients).toHaveBeenCalledWith(salonId, {
      page: 1,
      pageSize: 20,
      search: 'Client',
    })
  })

  it('updates salon status and writes an audit event', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'active' },
      members: [],
      stats: {},
    } as never)
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
      }),
    )
  })

  it('does not activate a Setup Salon outside the handoff flow', async () => {
    vi.mocked(getAdminSalon).mockResolvedValue({
      salon: { id: salonId, status: 'setup' },
      members: [],
      stats: {},
    } as never)

    const res = await app.request(`/api/v1/admin/salons/${salonId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'active',
      }),
    })

    expect(res.status).toBe(409)
    expect(updateAdminSalonStatus).not.toHaveBeenCalled()
  })

  it('lists and creates internal salon notes', async () => {
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

  it('creates a CatalogPreset and writes audit event', async () => {
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
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog_preset.create',
        targetType: 'catalog_preset',
        targetId: presetId,
      }),
    )
  })

  it('updates a CatalogPreset and writes audit event', async () => {
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

    const res = await app.request(`/api/v1/admin/catalog-presets/${presetId}`, {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'قالب خدمات مو و ابرو',
        isActive: false,
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      preset: { id: presetId, name: 'قالب خدمات مو و ابرو' },
    })
    expect(updateAdminCatalogPreset).toHaveBeenCalledWith({
      id: presetId,
      name: 'قالب خدمات مو و ابرو',
      isActive: false,
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'catalog_preset.update',
        targetType: 'catalog_preset',
        targetId: presetId,
      }),
    )
  })

  it('lets platform owners list platform admins', async () => {
    vi.mocked(listPlatformAdmins).mockResolvedValue({
      items: [
        {
          id: platformAdminId,
          userId: platformAdminUserId,
          name: 'Support Admin',
          email: 'support@example.com',
          phoneNumber: null,
          username: 'support',
          role: 'platform_support',
          active: true,
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    } as never)

    const res = await app.request(
      '/api/v1/admin/platform-admins?page=1&pageSize=20&search=support',
      { headers: authHeaders },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      items: [{ id: platformAdminId, role: 'platform_support' }],
      pagination: { total: 1 },
    })
    expect(listPlatformAdmins).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: 'support',
    })
  })

  it('denies platform admin management to non-owner platform roles', async () => {
    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'platform-admin-2',
      userId: 'admin-user-1',
      role: 'platform_admin',
      active: true,
    } as never)

    const listRes = await app.request('/api/v1/admin/platform-admins', {
      headers: authHeaders,
    })
    const createRes = await app.request('/api/v1/admin/platform-admins', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: platformAdminUserId,
        role: 'platform_support',
        active: true,
      }),
    })

    expect(listRes.status).toBe(403)
    expect(createRes.status).toBe(403)
    expect(listPlatformAdmins).not.toHaveBeenCalled()
    expect(upsertPlatformAdmin).not.toHaveBeenCalled()
  })

  it('creates platform admin access and writes audit event', async () => {
    vi.mocked(upsertPlatformAdmin).mockResolvedValue({
      id: platformAdminId,
      userId: platformAdminUserId,
      role: 'platform_support',
      active: true,
    } as never)
    vi.mocked(createAdminAuditEvent).mockResolvedValue({
      id: 'audit-platform-admin-create',
    } as never)

    const res = await app.request('/api/v1/admin/platform-admins', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: platformAdminUserId,
        role: 'platform_support',
        active: true,
      }),
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      admin: { id: platformAdminId, role: 'platform_support' },
    })
    expect(upsertPlatformAdmin).toHaveBeenCalledWith({
      userId: platformAdminUserId,
      role: 'platform_support',
      active: true,
      actorUserId: 'admin-user-1',
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform_admin.upsert',
        targetType: 'platform_admin',
        targetId: platformAdminId,
      }),
    )
  })
})
