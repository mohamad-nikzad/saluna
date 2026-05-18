import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/onboarding', () => ({
  getOnboardingStatus: vi.fn(),
  updateOnboardingState: vi.fn(),
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as db from '@repo/database/onboarding'
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

describe('onboarding router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/onboarding')
    expect(res.status).toBe(401)
  })

  it('403 for staff', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/onboarding', { headers: authHeaders })
    expect(res.status).toBe(403)
  })

  it('GET returns status for manager', async () => {
    vi.mocked(db.getOnboardingStatus).mockResolvedValue({ state: 'pending' } as never)
    const res = await app.request('/api/v1/onboarding', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ onboarding: { state: 'pending' } })
  })

  it('PATCH 400 on invalid action', async () => {
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bogus' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'درخواست نامعتبر است' })
  })

  it('PATCH valid action updates state', async () => {
    vi.mocked(db.updateOnboardingState).mockResolvedValue({ state: 'complete' } as never)
    const res = await app.request('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    })
    expect(res.status).toBe(200)
    expect(db.updateOnboardingState).toHaveBeenCalledWith('s1', 'complete')
  })
})
