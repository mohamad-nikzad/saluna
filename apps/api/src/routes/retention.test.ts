import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/retention', () => ({
  getRetentionQueue: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  updateClientFollowUpStatus: vi.fn(),
  isClientProvidedEntityId: (id: string | undefined) =>
    typeof id === 'string' && id.length > 0,
}))

vi.mock('@repo/auth/auth', () => ({
  verifySession: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: vi.fn(),
}))

import * as retentionDb from '@repo/database/retention'
import * as clientsDb from '@repo/database/clients'
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

describe('retention router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/retention')
    expect(res.status).toBe(401)
  })

  it('403 for staff', async () => {
    vi.mocked(getUserById).mockResolvedValue(staffUser as never)
    const res = await app.request('/api/v1/retention', { headers: authHeaders })
    expect(res.status).toBe(403)
  })

  it('GET returns retention queue', async () => {
    vi.mocked(retentionDb.getRetentionQueue).mockResolvedValue([{ id: 'r1' }] as never)
    const res = await app.request('/api/v1/retention', { headers: authHeaders })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ items: [{ id: 'r1' }] })
  })

  it('PATCH 400 on invalid status', async () => {
    const res = await app.request('/api/v1/retention/abc', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'bogus' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'وضعیت نامعتبر است' })
  })

  it('PATCH 404 when follow-up missing', async () => {
    vi.mocked(clientsDb.updateClientFollowUpStatus).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/retention/abc', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    })
    expect(res.status).toBe(404)
  })

  it('PATCH 200 on success', async () => {
    vi.mocked(clientsDb.updateClientFollowUpStatus).mockResolvedValue({
      id: 'f1',
      status: 'reviewed',
    } as never)
    const res = await app.request('/api/v1/retention/abc', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    })
    expect(res.status).toBe(200)
    expect(clientsDb.updateClientFollowUpStatus).toHaveBeenCalledWith('s1', 'abc', 'reviewed')
  })
})
