import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/staff', () => ({
  resolveStaffTenantContext: vi.fn(),
  getAllStaff: vi.fn(),
  createManagerStaffInvite: vi.fn(),
  deactivateStaffMember: vi.fn(),
  getUserById: vi.fn(),
  getUserWithServiceIds: vi.fn(),
  reactivateStaffProfile: vi.fn(),
  revokeStaffProfileAccess: vi.fn(),
  setStaffServiceIds: vi.fn(),
  setStaffSchedules: vi.fn(),
  getStaffSchedules: vi.fn(),
  getStaffBookingAvailabilityForSlot: vi.fn(),
  getBusinessSettings: vi.fn(),
  updateStaffMember: vi.fn(),
  updateStaffPassword: vi.fn(),
  validateActiveServiceIds: vi.fn(),
  countManagers: vi.fn(),
}))

vi.mock('@repo/auth/server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
  getManagerMemberForUser: vi.fn(),
}))

import * as db from '@repo/database/staff'
import { auth as authServer } from '@repo/auth/server'
import { getManagerMemberForUser, getMemberForUser } from '@repo/database/members'
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

const validCreate = {
  name: 'Ali',
  phone: '09121234567',
  role: 'staff',
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

describe('staff router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/staff')
    expect(res.status).toBe(401)
  })

  it('200 on GET / for any authed user', async () => {
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
    vi.mocked(db.getAllStaff).mockResolvedValue([{ id: 'u2' }] as never)
    const res = await app.request('/api/v1/staff', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ staff: [{ id: 'u2' }] })
  })

  it('staff is 403 on POST', async () => {
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
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(403)
  })

  it('400 on invalid create (missing phone)', async () => {
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ali' }),
    })
    expect(res.status).toBe(400)
  })

  it('200 on POST create Staff Invite with name and phone only', async () => {
    vi.mocked(db.createManagerStaffInvite).mockResolvedValue({
      status: 'created',
      profile: {
        id: 'profile-1',
        name: 'Ali',
        phone: '09121234567',
        userId: null,
      },
      invite: { id: 'invite-1', status: 'pending' },
      inviteToken: 'token',
    } as never)
    vi.mocked(db.getUserWithServiceIds).mockResolvedValue({
      id: 'profile-1',
      name: 'Ali',
      phone: '09121234567',
      inviteStatus: 'pending',
      role: 'staff',
    } as never)
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ali', phone: '09121234567' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: {
        id: 'profile-1',
        name: 'Ali',
        phone: '09121234567',
        inviteStatus: 'pending',
        role: 'staff',
      },
    })
    expect(db.createManagerStaffInvite).toHaveBeenCalledWith({
      salonId: 's1',
      name: 'Ali',
      phone: '09121234567',
      invitedByUserId: 'u1',
    })
    // Pending invites must not mint manager-controlled credentials.
    expect(db.updateStaffPassword).not.toHaveBeenCalled()
  })

  it('409 on duplicate pending invite', async () => {
    vi.mocked(db.createManagerStaffInvite).mockResolvedValue({
      status: 'rejected',
      reason: 'duplicate_pending_invite',
    } as never)
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'برای این شماره قبلاً دعوت در انتظار وجود دارد',
      code: 'duplicate_pending_invite',
    })
  })

  it('409 when inviting an inactive Staff Profile', async () => {
    vi.mocked(db.createManagerStaffInvite).mockResolvedValue({
      status: 'rejected',
      reason: 'inactive_profile',
    } as never)
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error:
        'این پروفایل پرسنل غیرفعال است. ابتدا آن را فعال کنید و بعد دعوت بفرستید.',
      code: 'inactive_profile',
    })
  })

  it('409 on duplicate active Staff Profile for the same phone', async () => {
    vi.mocked(db.createManagerStaffInvite).mockResolvedValue({
      status: 'rejected',
      reason: 'duplicate_active_profile',
    } as never)
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'برای این شماره قبلاً پروفایل پرسنل فعال در این سالن وجود دارد',
      code: 'duplicate_active_profile',
    })
  })

  it('404 when password update target has no tenant membership', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'profile-1',
      salonId: 's1',
      role: 'staff',
      inviteStatus: 'pending',
    } as never)
    vi.mocked(db.updateStaffPassword).mockResolvedValue(false as never)
    const res = await app.request('/api/v1/staff/profile-1/password', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'newsecret123',
      }),
    })
    expect(res.status).toBe(404)
    expect(db.updateStaffPassword).toHaveBeenCalledWith(
      's1',
      'profile-1',
      'newsecret123',
    )
  })

  it('200 on GET includes pending inviteStatus for invited staff', async () => {
    vi.mocked(db.getAllStaff).mockResolvedValue([
      {
        id: 'profile-1',
        name: 'Ali',
        inviteStatus: 'pending',
        role: 'staff',
      },
    ] as never)
    const res = await app.request('/api/v1/staff', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      staff: [
        {
          id: 'profile-1',
          name: 'Ali',
          inviteStatus: 'pending',
          role: 'staff',
        },
      ],
    })
  })

  it('allows schedule config for pending invited Staff Profile', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'profile-1',
      salonId: 's1',
      role: 'staff',
      inviteStatus: 'pending',
    } as never)
    vi.mocked(db.setStaffSchedules).mockResolvedValue([
      { dayOfWeek: 0, active: true },
    ] as never)
    const res = await app.request('/api/v1/staff/profile-1/schedule', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule: [
          {
            dayOfWeek: 0,
            active: true,
            workingStart: '09:00',
            workingEnd: '17:00',
          },
        ],
      }),
    })
    expect(res.status).toBe(200)
    expect(db.setStaffSchedules).toHaveBeenCalledWith(
      's1',
      'profile-1',
      expect.any(Array),
    )
  })

  it('allows ServiceVariant capability config for pending invited Staff Profile', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'profile-1',
      salonId: 's1',
      role: 'staff',
      inviteStatus: 'pending',
    } as never)
    vi.mocked(db.validateActiveServiceIds).mockResolvedValue(true as never)
    vi.mocked(db.getUserWithServiceIds).mockResolvedValue({
      id: 'profile-1',
      serviceIds: ['svc-1'],
      inviteStatus: 'pending',
    } as never)
    const res = await app.request('/api/v1/staff/profile-1/services', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['svc-1'] }),
    })
    expect(res.status).toBe(200)
    expect(db.setStaffServiceIds).toHaveBeenCalledWith(
      'profile-1',
      ['svc-1'],
      's1',
    )
  })

  it('400 on booking-availability missing params', async () => {
    const res = await app.request('/api/v1/staff/booking-availability', {
      headers: authHeaders,
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'تاریخ و ساعت شروع و پایان الزامی است',
    })
  })

  it('200 on PATCH /:id/password', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.updateStaffPassword).mockResolvedValue(true as never)
    const res = await app.request('/api/v1/staff/u2/password', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'newsecret123',
        confirmPassword: 'newsecret123',
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(db.updateStaffPassword).toHaveBeenCalledWith(
      's1',
      'u2',
      'newsecret123',
    )
  })

  it('400 on PATCH /:id/password short password', async () => {
    const res = await app.request('/api/v1/staff/u2/password', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: '123',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('200 on DELETE /:id soft deletes staff', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.deactivateStaffMember).mockResolvedValue(true as never)
    const res = await app.request('/api/v1/staff/u2', {
      method: 'DELETE',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(db.deactivateStaffMember).toHaveBeenCalledWith('s1', 'u2')
  })

  it('400 on DELETE current user', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u1',
      salonId: 's1',
      role: 'manager',
    } as never)
    const res = await app.request('/api/v1/staff/u1', {
      method: 'DELETE',
      headers: authHeaders,
    })
    expect(res.status).toBe(400)
    expect(db.deactivateStaffMember).not.toHaveBeenCalled()
  })

  it('400 on booking-availability with end before start', async () => {
    const res = await app.request(
      '/api/v1/staff/booking-availability?date=2026-05-18&startTime=10:00&endTime=09:00',
      { headers: authHeaders },
    )
    expect(res.status).toBe(400)
  })

  it('200 on booking-availability', async () => {
    vi.mocked(db.getStaffBookingAvailabilityForSlot).mockResolvedValue([
      { staffId: 'u2', available: true },
    ] as never)
    const res = await app.request(
      '/api/v1/staff/booking-availability?date=2026-05-18&startTime=10:00&endTime=10:30',
      { headers: authHeaders },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      staff: [{ staffId: 'u2', available: true }],
    })
  })

  it('staff is 403 on booking-availability', async () => {
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
    const res = await app.request(
      '/api/v1/staff/booking-availability?date=2026-05-18&startTime=10:00&endTime=10:30',
      { headers: authHeaders },
    )
    expect(res.status).toBe(403)
  })

  it('404 on GET /:id/schedule when target not staff in salon', async () => {
    vi.mocked(db.getUserById).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/staff/missing/schedule', {
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'پرسنل یافت نشد' })
  })

  it('200 on GET /:id/schedule', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.getStaffSchedules).mockResolvedValue([
      { dayOfWeek: 0 },
    ] as never)
    vi.mocked(db.getBusinessSettings).mockResolvedValue({
      openTime: '09:00',
    } as never)
    const res = await app.request('/api/v1/staff/u2/schedule', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      schedule: [{ dayOfWeek: 0 }],
      businessHours: { openTime: '09:00' },
    })
  })

  it('200 on PUT /:id/schedule', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.setStaffSchedules).mockResolvedValue([
      { dayOfWeek: 0 },
    ] as never)
    const body = {
      schedule: [
        {
          dayOfWeek: 0,
          active: true,
          workingStart: '09:00',
          workingEnd: '17:00',
        },
      ],
    }
    const res = await app.request('/api/v1/staff/u2/schedule', {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ schedule: [{ dayOfWeek: 0 }] })
  })

  it('404 on PATCH /:id/services missing user', async () => {
    vi.mocked(db.getUserById).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/staff/missing/services', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['s1'] }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'کاربر یافت نشد' })
  })

  it('400 on PATCH /:id/services for manager target', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u3',
      salonId: 's1',
      role: 'manager',
    } as never)
    const res = await app.request('/api/v1/staff/u3/services', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['s1'] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'فقط برای اعضای با نقش «پرسنل» می‌توان خدمات تعیین کرد.',
    })
  })

  it('400 on PATCH /:id/services with invalid service ids', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.validateActiveServiceIds).mockResolvedValue(false)
    const res = await app.request('/api/v1/staff/u2/services', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['bad'] }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'یک یا چند شناسه خدمت نامعتبر یا غیرفعال است.',
    })
  })

  it('200 on PATCH /:id/services', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.validateActiveServiceIds).mockResolvedValue(true)
    vi.mocked(db.setStaffServiceIds).mockResolvedValue(undefined as never)
    vi.mocked(db.getUserWithServiceIds).mockResolvedValue({
      id: 'u2',
      serviceIds: ['s1'],
    } as never)
    const res = await app.request('/api/v1/staff/u2/services', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: ['s1'] }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      staff: { id: 'u2', serviceIds: ['s1'] },
    })
  })

  it('200 on PATCH /:id/services with null clears assignments', async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'u2',
      salonId: 's1',
      role: 'staff',
    } as never)
    vi.mocked(db.setStaffServiceIds).mockResolvedValue(undefined as never)
    vi.mocked(db.getUserWithServiceIds).mockResolvedValue({
      id: 'u2',
      serviceIds: null,
    } as never)
    const res = await app.request('/api/v1/staff/u2/services', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceIds: null }),
    })
    expect(res.status).toBe(200)
    expect(db.validateActiveServiceIds).not.toHaveBeenCalled()
  })

  it('200 on POST /:id/access/revoke revokes Staff Profile Access only', async () => {
    vi.mocked(db.revokeStaffProfileAccess).mockResolvedValue({
      status: 'revoked',
      access: {
        id: 'access-1',
        salonId: 's1',
        staffProfileId: 'profile-u2',
        userId: 'u2',
        staffInviteId: null,
        acceptedAt: new Date('2026-07-01T00:00:00Z'),
        revokedAt: new Date('2026-07-11T00:00:00Z'),
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-11T00:00:00Z'),
      },
      profile: {
        id: 'profile-u2',
        salonId: 's1',
        userId: null,
        name: 'Sara',
        phone: '09121234567',
        color: 'rose',
        active: true,
        claimedAt: new Date('2026-07-01T00:00:00Z'),
        accessDetachedAt: new Date('2026-07-11T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        updatedAt: new Date('2026-07-11T00:00:00Z'),
      },
      profileDeactivated: false,
    })

    const res = await app.request('/api/v1/staff/u2/access/revoke', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(db.revokeStaffProfileAccess).toHaveBeenCalledWith({
      salonId: 's1',
      targetId: 'u2',
    })
    expect(db.deactivateStaffMember).not.toHaveBeenCalled()
    expect(await res.json()).toMatchObject({
      success: true,
      access: {
        id: 'access-1',
        staffProfileId: 'profile-u2',
        revokedAt: '2026-07-11T00:00:00.000Z',
      },
      profile: { id: 'profile-u2', active: true, userId: null },
    })
  })

  it('409 on POST /:id/access/revoke when access already revoked', async () => {
    vi.mocked(db.revokeStaffProfileAccess).mockResolvedValue({
      status: 'rejected',
      reason: 'already_revoked',
    })

    const res = await app.request('/api/v1/staff/u2/access/revoke', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'already_revoked' })
  })

  it('400 on POST /:id/access/revoke for current user', async () => {
    const res = await app.request('/api/v1/staff/u1/access/revoke', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(400)
    expect(db.revokeStaffProfileAccess).not.toHaveBeenCalled()
  })

  it('200 on POST /:id/reactivate does not restore access', async () => {
    vi.mocked(db.reactivateStaffProfile).mockResolvedValue({
      status: 'reactivated',
      profile: {
        id: 'profile-u2',
        salonId: 's1',
        userId: null,
        name: 'Sara',
        phone: '09121234567',
        color: 'rose',
        active: true,
        claimedAt: null,
        accessDetachedAt: new Date('2026-07-11T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        updatedAt: new Date('2026-07-11T12:00:00Z'),
      },
    })

    const res = await app.request('/api/v1/staff/profile-u2/reactivate', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(db.reactivateStaffProfile).toHaveBeenCalledWith({
      salonId: 's1',
      staffProfileId: 'profile-u2',
    })
    expect(await res.json()).toMatchObject({
      success: true,
      profile: { id: 'profile-u2', active: true, userId: null },
    })
  })
})
