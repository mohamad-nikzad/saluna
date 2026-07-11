import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/clients', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/database/clients')>()
  return {
    ...actual,
    getAllClients: vi.fn(),
    getClientById: vi.fn(),
    getClientTags: vi.fn(),
    setClientTags: vi.fn(),
    createClient: vi.fn(),
    createClientsBulk: vi.fn(),
    updateClient: vi.fn(),
    isClientProvidedEntityId: (id: string | undefined) =>
      typeof id === 'string' && id.length > 0,
    getClientSummary: vi.fn(),
    createClientFollowUp: vi.fn(),
  }
})

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

import * as db from '@repo/database/clients'
import { auth as authServer } from '@repo/auth/server'
import {
  getManagerMemberForUser,
  getMemberForUser,
} from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'
import { MAX_BULK_CLIENTS } from '@repo/salon-core/forms/limits'

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

describe('clients router', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/v1/clients')
    expect(res.status).toBe(401)
  })

  it('returns 200 list shape with stubbed getAllClients', async () => {
    vi.mocked(db.getAllClients).mockResolvedValue([{ id: 'c1' }] as never)
    const res = await app.request('/api/v1/clients', { headers: authHeaders() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ clients: [{ id: 'c1' }] })
  })

  it('returns 400 on invalid create body', async () => {
    const res = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', phone: 'bogus' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(typeof body.error).toBe('string')
  })

  it('returns 409 duplicate-phone code', async () => {
    vi.mocked(db.createClient).mockRejectedValue(
      new Error('duplicate key value'),
    )
    const res = await app.request('/api/v1/clients', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ali', phone: '09121234567', tags: [] }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'این شماره تماس برای این سالن قبلاً ثبت شده است',
      code: 'duplicate-phone',
    })
  })

  it('returns 401 for bulk create without auth', async () => {
    const res = await app.request('/api/v1/clients/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clients: [{ name: 'Ali', phone: '09121234567' }],
      }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for bulk create with empty clients array', async () => {
    const res = await app.request('/api/v1/clients/bulk', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients: [] }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(typeof body.error).toBe('string')
  })

  it(`returns 400 for bulk create with more than ${MAX_BULK_CLIENTS} clients`, async () => {
    const clients = Array.from(
      { length: MAX_BULK_CLIENTS + 1 },
      (_, index) => ({
        name: `Client ${index}`,
        phone: '09123456789',
      }),
    )
    const res = await app.request('/api/v1/clients/bulk', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(typeof body.error).toBe('string')
  })

  it('returns 200 bulk create response shape from createClientsBulk', async () => {
    vi.mocked(db.createClientsBulk).mockResolvedValue({
      created: [
        { id: 'c1', name: 'Ali', phone: '09121234567', isPlaceholder: false },
      ],
      skipped: [{ phone: '09129876543', reason: 'duplicate-phone' }],
    } as never)

    const res = await app.request('/api/v1/clients/bulk', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clients: [
          { name: 'Ali', phone: '09121234567' },
          { name: 'Sara', phone: '09129876543' },
        ],
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      created: [
        { id: 'c1', name: 'Ali', phone: '09121234567', isPlaceholder: false },
      ],
      skipped: [{ phone: '09129876543', reason: 'duplicate-phone' }],
    })
    expect(db.createClientsBulk).toHaveBeenCalledWith('s1', [
      { name: 'Ali', phone: '09121234567' },
      { name: 'Sara', phone: '09129876543' },
    ])
  })

  it('accepts unknown follow-up reason and defaults to manual', async () => {
    vi.mocked(db.getClientById).mockResolvedValue({
      id: 'c1',
      name: 'Ali',
    } as never)
    vi.mocked(db.createClientFollowUp).mockResolvedValue({
      id: 'f1',
      reason: 'manual',
      status: 'open',
    } as never)

    const res = await app.request('/api/v1/clients/c1/follow-ups', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'bogus' }),
    })

    expect(res.status).toBe(200)
    expect(db.createClientFollowUp).toHaveBeenCalledWith(
      's1',
      'c1',
      'manual',
      undefined,
    )
  })
})
