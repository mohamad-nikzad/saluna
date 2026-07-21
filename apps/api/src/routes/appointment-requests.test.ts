import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'

vi.mock('@repo/database/appointment-requests', () => ({
  listAppointmentRequests: vi.fn(),
  createFlexibleAppointmentRequest: vi.fn(),
  approveAppointmentRequest: vi.fn(),
  rejectAppointmentRequest: vi.fn(),
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

import * as db from '@repo/database/appointment-requests'
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

const staffUser = {
  id: 'u2',
  salonId: 's1',
  role: 'staff' as const,
  name: 'Staff',
  phone: '09120000001',
  createdAt: new Date(),
}

const requestId = '22222222-2222-2222-2222-222222222222'
const validFlexibleDate = addDaysYmd(salonTodayYmd(), 2)

function authHeaders() {
  return { Authorization: 'Bearer testtoken' }
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

describe('appointment-requests router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/appointment-requests')
    expect(res.status).toBe(401)
  })

  it('returns 403 for staff role', async () => {
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
    const res = await app.request('/api/v1/appointment-requests', {
      headers: authHeaders(),
    })
    expect(res.status).toBe(403)
  })

  it('GET / returns list for tenant salon', async () => {
    vi.mocked(db.listAppointmentRequests).mockResolvedValue([
      { id: 'r1', existingClient: null } as never,
    ])
    const res = await app.request('/api/v1/appointment-requests', {
      headers: authHeaders(),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { requests: unknown[] }
    expect(body.requests).toHaveLength(1)
    expect(db.listAppointmentRequests).toHaveBeenCalledWith('s1', {})
  })

  it('GET /?status=expired forwards the filter', async () => {
    vi.mocked(db.listAppointmentRequests).mockResolvedValue([])
    await app.request('/api/v1/appointment-requests?status=expired', {
      headers: authHeaders(),
    })
    expect(db.listAppointmentRequests).toHaveBeenCalledWith('s1', {
      status: 'expired',
    })
  })

  it('GET /?timingMode=flexible lists tenant Drafts', async () => {
    vi.mocked(db.listAppointmentRequests).mockResolvedValue([])
    await app.request('/api/v1/appointment-requests?timingMode=flexible', {
      headers: authHeaders(),
    })
    expect(db.listAppointmentRequests).toHaveBeenCalledWith('s1', {
      timingMode: 'flexible',
    })
  })

  it('POST / creates a tenant-scoped flexible Draft', async () => {
    vi.mocked(db.createFlexibleAppointmentRequest).mockResolvedValue({
      ok: true,
      request: { id: requestId },
    } as never)
    const body = {
      clientId: '33333333-3333-4333-8333-333333333333',
      serviceId: '44444444-4444-4444-8444-444444444444',
      acceptableDates: [validFlexibleDate],
      timePreference: 'afternoon',
      notes: 'بعد از ظهر تماس بگیرید',
    }
    const res = await app.request('/api/v1/appointment-requests', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(201)
    expect(db.createFlexibleAppointmentRequest).toHaveBeenCalledWith({
      salonId: 's1',
      ...body,
    })
  })

  it.each([
    [
      {
        serviceId: requestId,
        acceptableDates: [validFlexibleDate],
        timePreference: 'morning',
      },
    ],
    [
      {
        clientId: requestId,
        serviceId: requestId,
        acceptableDates: [],
        timePreference: 'morning',
      },
    ],
    [
      {
        clientId: requestId,
        serviceId: requestId,
        acceptableDates: ['2026-02-30'],
        timePreference: 'morning',
      },
    ],
    [
      {
        clientId: requestId,
        serviceId: requestId,
        acceptableDates: [validFlexibleDate],
        timePreference: 'late',
      },
    ],
    [
      {
        clientId: requestId,
        serviceId: requestId,
        acceptableDates: [validFlexibleDate],
        timePreference: 'morning',
        requestedDate: validFlexibleDate,
      },
    ],
  ])('POST / rejects invalid flexible input %#', async (body) => {
    const res = await app.request('/api/v1/appointment-requests', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
    expect(db.createFlexibleAppointmentRequest).not.toHaveBeenCalled()
  })

  it('POST /:id/approve calls approveAppointmentRequest with tenant context', async () => {
    vi.mocked(db.approveAppointmentRequest).mockResolvedValue({
      ok: true,
      appointmentId: 'apt1',
      clientId: 'cli1',
    } as never)
    const res = await app.request(
      `/api/v1/appointment-requests/${requestId}/approve`,
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: 'staff1' }),
      },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      appointmentId: 'apt1',
      clientId: 'cli1',
    })
    expect(db.approveAppointmentRequest).toHaveBeenCalledWith({
      id: requestId,
      salonId: 's1',
      staffId: 'staff1',
      reviewedByUserId: 'u1',
    })
  })

  it('POST /:id/approve returns 409 with code on slot conflict', async () => {
    vi.mocked(db.approveAppointmentRequest).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'slot taken',
      code: 'slot-conflict',
    } as never)
    const res = await app.request(
      `/api/v1/appointment-requests/${requestId}/approve`,
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: 'staff1' }),
      },
    )
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'slot taken',
      code: 'slot-conflict',
    })
  })

  it('POST /:id/approve 400 when staffId missing', async () => {
    const res = await app.request(
      `/api/v1/appointment-requests/${requestId}/approve`,
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(400)
  })

  it('POST /:id/reject forwards reason', async () => {
    vi.mocked(db.rejectAppointmentRequest).mockResolvedValue({
      ok: true,
    } as never)
    const res = await app.request(
      `/api/v1/appointment-requests/${requestId}/reject`,
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'full' }),
      },
    )
    expect(res.status).toBe(200)
    expect(db.rejectAppointmentRequest).toHaveBeenCalledWith({
      id: requestId,
      salonId: 's1',
      reviewedByUserId: 'u1',
      reason: 'full',
    })
  })

  it('POST /:id/reject returns 409 when not pending', async () => {
    vi.mocked(db.rejectAppointmentRequest).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'این درخواست قابل رد نیست',
    } as never)
    const res = await app.request(
      `/api/v1/appointment-requests/${requestId}/reject`,
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(409)
  })
})
