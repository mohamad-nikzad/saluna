import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/services', () => ({
  createServicePackageBooking: vi.fn(),
  getAllServicePackages: vi.fn(),
  getServicePackageById: vi.fn(),
  createServicePackage: vi.fn(),
  updateServicePackage: vi.fn(),
  replaceServicePackageComponents: vi.fn(),
  replaceServicePackageStaffCapabilities: vi.fn(),
  getAllServiceCategories: vi.fn(),
  createServiceCategory: vi.fn(),
  updateServiceCategory: vi.fn(),
  getAllServiceAddons: vi.fn(),
  createServiceAddon: vi.fn(),
  updateServiceAddon: vi.fn(),
  getAllServices: vi.fn(),
  getServiceById: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  getActiveServiceAddonsForService: vi.fn(),
  importStarterServiceTemplates: vi.fn(),
  getComboComponents: vi.fn(),
  replaceComboComponents: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  isClientProvidedEntityId: (id: string | undefined) =>
    typeof id === 'string' && id.length > 0,
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

import * as db from '@repo/database/services'
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

const packageResponse = {
  id: 'pkg-1',
  name: 'Bride',
  priceOverride: null,
  componentPriceTotal: 600000,
  resolvedPrice: 600000,
  components: [],
}

const bookingResponse = {
  id: 'booking-1',
  salonId: 's1',
  packageId: 'pkg-1',
  clientId: 'client-1',
  leadStaffId: 'staff-1',
  date: '2026-07-02',
  bookedPackageName: 'Bride',
  bookedPackagePrice: 600000,
  status: 'scheduled',
  notes: null,
  createdByUserId: 'u1',
  tasks: [
    {
      id: 'task-1',
      salonId: 's1',
      packageBookingId: 'booking-1',
      packageComponentId: 'component-1',
      serviceId: 'svc-1',
      appointmentId: 'apt-1',
      staffId: 'staff-1',
      startTime: '10:00',
      endTime: '11:00',
      sortOrder: 0,
    },
  ],
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

describe('service-packages router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/service-packages')
    expect(res.status).toBe(401)
  })

  it('staff is 403 on list', async () => {
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

    const res = await app.request('/api/v1/service-packages?all=1', {
      headers: authHeaders,
    })

    expect(res.status).toBe(403)
    expect(db.getAllServicePackages).not.toHaveBeenCalled()
  })

  it('manager includes inactive packages with all=1', async () => {
    vi.mocked(db.getAllServicePackages).mockResolvedValue([
      packageResponse,
    ] as never)

    const res = await app.request('/api/v1/service-packages?all=1', {
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ packages: [packageResponse] })
    expect(db.getAllServicePackages).toHaveBeenCalledWith('s1', true)
  })

  it('staff is 403 on create', async () => {
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

    const res = await app.request('/api/v1/service-packages', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bride' }),
    })

    expect(res.status).toBe(403)
  })

  it('creates a package definition with nullable price override', async () => {
    vi.mocked(db.createServicePackage).mockResolvedValue(
      packageResponse as never,
    )

    const res = await app.request('/api/v1/service-packages', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bride',
        categoryId: 'cat-1',
        priceOverride: null,
        sortOrder: 3,
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ package: packageResponse })
    expect(db.createServicePackage).toHaveBeenCalledWith({
      name: 'Bride',
      categoryId: 'cat-1',
      priceOverride: null,
      active: true,
      sortOrder: 3,
      salonId: 's1',
    })
  })

  it('maps duplicate package names to 409', async () => {
    vi.mocked(db.createServicePackage).mockRejectedValue(
      new Error('active service package name must be unique per salon'),
    )

    const res = await app.request('/api/v1/service-packages', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bride' }),
    })

    expect(res.status).toBe(409)
  })

  it('archives a package through update', async () => {
    vi.mocked(db.updateServicePackage).mockResolvedValue({
      ...packageResponse,
      active: false,
    } as never)

    const res = await app.request('/api/v1/service-packages/pkg-1', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      package: { ...packageResponse, active: false },
    })
    expect(db.updateServicePackage).toHaveBeenCalledWith('pkg-1', 's1', {
      active: false,
    })
  })

  it('replaces components and prevents duplicate included services', async () => {
    vi.mocked(db.replaceServicePackageComponents).mockRejectedValue(
      new Error('service package components cannot contain duplicates'),
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['svc-1', 'svc-1'] }),
    })

    expect(res.status).toBe(400)
  })

  it('maps invalid component services to 400', async () => {
    vi.mocked(db.replaceServicePackageComponents).mockRejectedValue(
      new Error('service package cannot contain legacy combo services'),
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['combo-1'] }),
    })

    expect(res.status).toBe(400)
  })

  it('writes deterministic component order', async () => {
    vi.mocked(db.replaceServicePackageComponents).mockResolvedValue(
      packageResponse as never,
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/components', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['svc-2', 'svc-1'] }),
    })

    expect(res.status).toBe(200)
    expect(db.replaceServicePackageComponents).toHaveBeenCalledWith(
      'pkg-1',
      's1',
      ['svc-2', 'svc-1'],
    )
  })

  it('staff is 403 on package staff capabilities update', async () => {
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

    const res = await app.request('/api/v1/service-packages/pkg-1/staff', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIds: ['staff-1'] }),
    })

    expect(res.status).toBe(403)
    expect(db.replaceServicePackageStaffCapabilities).not.toHaveBeenCalled()
  })

  it('replaces explicit staff package capabilities', async () => {
    vi.mocked(db.replaceServicePackageStaffCapabilities).mockResolvedValue({
      ...packageResponse,
      staffIds: ['staff-2', 'staff-1'],
    } as never)

    const res = await app.request('/api/v1/service-packages/pkg-1/staff', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIds: ['staff-2', 'staff-1'] }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      package: { ...packageResponse, staffIds: ['staff-2', 'staff-1'] },
    })
    expect(db.replaceServicePackageStaffCapabilities).toHaveBeenCalledWith(
      'pkg-1',
      's1',
      ['staff-2', 'staff-1'],
    )
  })

  it('maps duplicate package staff capabilities to 400', async () => {
    vi.mocked(db.replaceServicePackageStaffCapabilities).mockRejectedValue(
      new Error('service package staff capabilities cannot contain duplicates'),
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/staff', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIds: ['staff-1', 'staff-1'] }),
    })

    expect(res.status).toBe(400)
  })

  it('manager schedules a package booking', async () => {
    vi.mocked(db.createServicePackageBooking).mockResolvedValue(
      bookingResponse as never,
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/bookings', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
        ],
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ booking: bookingResponse })
    expect(db.createServicePackageBooking).toHaveBeenCalledWith({
      salonId: 's1',
      packageId: 'pkg-1',
      clientId: 'client-1',
      date: '2026-07-02',
      tasks: [
        {
          packageComponentId: 'component-1',
          staffId: 'staff-1',
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
      notes: undefined,
      createdByUserId: 'u1',
    })
  })

  it('staff is 403 on package booking', async () => {
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

    const res = await app.request('/api/v1/service-packages/pkg-1/bookings', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
        ],
      }),
    })

    expect(res.status).toBe(403)
    expect(db.createServicePackageBooking).not.toHaveBeenCalled()
  })

  it('maps package booking conflicts to 409', async () => {
    vi.mocked(db.createServicePackageBooking).mockRejectedValue(
      new Error('service package booking staff conflict:STAFF_OVERLAP'),
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/bookings', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
        ],
      }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'STAFF_OVERLAP' })
  })

  it('maps invalid task service capability to 400', async () => {
    vi.mocked(db.createServicePackageBooking).mockRejectedValue(
      new Error('service package booking staff cannot perform service'),
    )

    const res = await app.request('/api/v1/service-packages/pkg-1/bookings', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'client-1',
        date: '2026-07-02',
        tasks: [
          {
            packageComponentId: 'component-1',
            staffId: 'staff-1',
            startTime: '10:00',
            endTime: '11:00',
          },
        ],
      }),
    })

    expect(res.status).toBe(400)
  })
})
