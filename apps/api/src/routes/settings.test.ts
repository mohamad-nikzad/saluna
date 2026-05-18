import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/settings', () => ({
  getBusinessSettings: vi.fn(),
  updateBusinessSettings: vi.fn(),
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as db from '@repo/database/settings'
import { verifySession } from '@repo/auth/auth'
import { getUserById } from '@repo/database/auth-users'

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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySession).mockResolvedValue('u1')
  vi.mocked(getUserById).mockResolvedValue(managerUser as never)
})

describe('settings router', () => {
  it('401 without auth on GET', async () => {
    const res = await app.request('/api/v1/settings/business')
    expect(res.status).toBe(401)
  })

  it('returns business settings to any tenant role', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    vi.mocked(db.getBusinessSettings).mockResolvedValue({ workingStart: '09:00' } as never)
    const res = await app.request('/api/v1/settings/business', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ settings: { workingStart: '09:00' } })
  })

  it('403 on PATCH for staff', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/settings/business', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingStart: '09:00', workingEnd: '17:00' }),
    })
    expect(res.status).toBe(403)
  })

  it('manager PATCH updates settings', async () => {
    vi.mocked(db.updateBusinessSettings).mockResolvedValue({ workingStart: '08:00' } as never)
    const res = await app.request('/api/v1/settings/business', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingStart: '08:00', workingEnd: '17:00' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ settings: { workingStart: '08:00' } })
    expect(db.updateBusinessSettings).toHaveBeenCalledWith('s1', {
      workingStart: '08:00',
      workingEnd: '17:00',
    })
  })

  it('400 when workingEnd <= workingStart', async () => {
    const res = await app.request('/api/v1/settings/business', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingStart: '17:00', workingEnd: '09:00' }),
    })
    expect(res.status).toBe(400)
  })
})
