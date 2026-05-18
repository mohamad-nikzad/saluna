import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/staff', () => ({
  getAllStaff: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  getUserWithServiceIds: vi.fn(),
  setStaffServiceIds: vi.fn(),
  setStaffSchedules: vi.fn(),
  getStaffSchedules: vi.fn(),
  getStaffBookingAvailabilityForSlot: vi.fn(),
  getBusinessSettings: vi.fn(),
  validateActiveServiceIds: vi.fn(),
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as db from '@repo/database/staff'
import { verifySession } from '@repo/auth/auth'
import { getUserById as getAuthUserById } from '@repo/database/auth-users'

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
  password: 'secret123',
  role: 'staff',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySession).mockResolvedValue('u1')
  vi.mocked(getAuthUserById).mockResolvedValue(managerUser as never)
})

describe('staff router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/staff')
    expect(res.status).toBe(401)
  })

  it('200 on GET / for any authed user', async () => {
    vi.mocked(getAuthUserById).mockResolvedValue(staffUser as never)
    vi.mocked(db.getAllStaff).mockResolvedValue([{ id: 'u2' }] as never)
    const res = await app.request('/api/v1/staff', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ staff: [{ id: 'u2' }] })
  })

  it('staff is 403 on POST', async () => {
    vi.mocked(getAuthUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(403)
  })

  it('400 on invalid create (short password)', async () => {
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validCreate, password: '123' }),
    })
    expect(res.status).toBe(400)
  })

  it('200 on POST create', async () => {
    vi.mocked(db.getAllStaff).mockResolvedValue([] as never)
    vi.mocked(db.createUser).mockResolvedValue({ id: 'u3', name: 'Ali' } as never)
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: { id: 'u3', name: 'Ali' } })
  })

  it('409 on duplicate phone', async () => {
    vi.mocked(db.getAllStaff).mockResolvedValue([] as never)
    vi.mocked(db.createUser).mockRejectedValue(new Error('unique violation'))
    const res = await app.request('/api/v1/staff', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(validCreate),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این شماره موبایل قبلاً ثبت شده است',
    })
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
    vi.mocked(getAuthUserById).mockResolvedValue(staffUser as never)
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
    vi.mocked(db.getStaffSchedules).mockResolvedValue([{ dayOfWeek: 0 }] as never)
    vi.mocked(db.getBusinessSettings).mockResolvedValue({ openTime: '09:00' } as never)
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
    vi.mocked(db.setStaffSchedules).mockResolvedValue([{ dayOfWeek: 0 }] as never)
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
})
