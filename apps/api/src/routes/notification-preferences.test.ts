import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/notifications', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as notif from '@repo/notifications'
import { verifySession } from '@repo/auth/auth'
import { getUserById } from '@repo/database/auth-users'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../app')

const staffUser = {
  id: 'u1',
  salonId: 's1',
  role: 'staff' as const,
  name: 'Staff',
  phone: '09120000000',
  createdAt: new Date(),
}

const authHeaders = { Authorization: 'Bearer testtoken' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySession).mockResolvedValue('u1')
  vi.mocked(getUserById).mockResolvedValue(staffUser as never)
})

describe('notification-preferences router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/notification-preferences')
    expect(res.status).toBe(401)
  })

  it('GET returns preferences', async () => {
    vi.mocked(notif.getNotificationPreferences).mockResolvedValue({
      appointmentAlertsEnabled: true,
    } as never)
    const res = await app.request('/api/v1/notification-preferences', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ preferences: { appointmentAlertsEnabled: true } })
    expect(notif.getNotificationPreferences).toHaveBeenCalledWith('s1', 'u1')
  })

  it('PATCH with valid boolean updates', async () => {
    vi.mocked(notif.updateNotificationPreferences).mockResolvedValue({
      smsAlertsEnabled: false,
    } as never)
    const res = await app.request('/api/v1/notification-preferences', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ smsAlertsEnabled: false }),
    })
    expect(res.status).toBe(200)
    expect(notif.updateNotificationPreferences).toHaveBeenCalledWith('s1', 'u1', {
      smsAlertsEnabled: false,
    })
  })

  it('PATCH 400 on non-boolean value', async () => {
    const res = await app.request('/api/v1/notification-preferences', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ smsAlertsEnabled: 'yes' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'مقدار تنظیمات اعلان نامعتبر است' })
  })
})
