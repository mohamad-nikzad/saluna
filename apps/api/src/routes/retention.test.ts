import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/retention', () => ({
  getRetentionQueue: vi.fn(),
}))

vi.mock('@repo/database/clients', () => ({
  createClientFollowUpMessageDelivery: vi.fn(),
  getClientFollowUpMessageContext: vi.fn(),
  getLatestClientFollowUpMessageDelivery: vi.fn(),
  updateClientFollowUpStatus: vi.fn(),
  isClientProvidedEntityId: (id: string | undefined) =>
    typeof id === 'string' && id.length > 0,
}))

vi.mock('@repo/notifications', () => ({
  normalizeBaleSafirPhone: vi.fn((phone: string) =>
    /^09\d{9}$/.test(phone) ? `98${phone.slice(1)}` : null
  ),
  sendBaleSafirMessage: vi.fn(),
}))

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
}))

import * as retentionDb from '@repo/database/retention'
import * as clientsDb from '@repo/database/clients'
import * as notifications from '@repo/notifications'
import { auth as authServer } from '@repo/auth/server'
import { getMemberForUser } from '@repo/database/members'

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
  vi.mocked(authServer.api.getSession).mockImplementation(async (args: any) => (args?.headers?.get?.('Authorization') ? { user: { id: 'u1' } } : null) as never)
  vi.mocked(getMemberForUser).mockResolvedValue({ userId: 'u1', organizationId: 's1', role: 'owner', name: 'Manager', username: '09120000000' } as never)
  vi.mocked(clientsDb.getLatestClientFollowUpMessageDelivery).mockResolvedValue(null as never)
  vi.mocked(clientsDb.createClientFollowUpMessageDelivery).mockImplementation(async (input) => ({
    id: 'd1',
    createdAt: new Date('2026-06-07T00:00:00.000Z'),
    sentAt: input.status === 'sent' ? new Date('2026-06-07T00:00:00.000Z') : null,
    providerMessageId: input.providerMessageId ?? null,
    error: input.error ?? null,
    ...input,
  }) as never)
  vi.mocked(notifications.sendBaleSafirMessage).mockResolvedValue({
    status: 'sent',
    providerMessageId: 'm1',
    phone: '989123456789',
  } as never)
})

describe('retention router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/retention')
    expect(res.status).toBe(401)
  })

  it('403 for staff', async () => {
    vi.mocked(getMemberForUser).mockResolvedValue({ userId: 'u2', organizationId: 's1', role: 'member', name: 'Staff', username: '09120000001' } as never)
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

  it('POST bale-message 404 when follow-up is missing', async () => {
    vi.mocked(clientsDb.getClientFollowUpMessageContext).mockResolvedValue(null as never)

    const res = await app.request('/api/v1/retention/f1/bale-message', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(404)
    expect(notifications.sendBaleSafirMessage).not.toHaveBeenCalled()
  })

  it('POST bale-message refuses invalid client phones', async () => {
    vi.mocked(clientsDb.getClientFollowUpMessageContext).mockResolvedValue({
      followUp: { id: 'f1', status: 'open', reason: 'inactive' },
      client: { id: 'c1', name: 'Client', phone: '02112345678' },
      salon: { id: 's1', name: 'Salon' },
    } as never)

    const res = await app.request('/api/v1/retention/f1/bale-message', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'شماره موبایل مشتری معتبر نیست' })
    expect(notifications.sendBaleSafirMessage).not.toHaveBeenCalled()
  })

  it('POST bale-message refuses duplicate successful sends', async () => {
    vi.mocked(clientsDb.getClientFollowUpMessageContext).mockResolvedValue({
      followUp: { id: 'f1', status: 'open', reason: 'inactive' },
      client: { id: 'c1', name: 'Client', phone: '09123456789' },
      salon: { id: 's1', name: 'Salon' },
    } as never)
    vi.mocked(clientsDb.getLatestClientFollowUpMessageDelivery).mockResolvedValue({
      id: 'd0',
      status: 'sent',
    } as never)

    const res = await app.request('/api/v1/retention/f1/bale-message', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'پیام بله قبلا ارسال شده است' })
    expect(notifications.sendBaleSafirMessage).not.toHaveBeenCalled()
  })

  it('POST bale-message sends through Safir and records delivery', async () => {
    vi.mocked(clientsDb.getClientFollowUpMessageContext).mockResolvedValue({
      followUp: { id: 'f1', status: 'open', reason: 'inactive' },
      client: { id: 'c1', name: 'Client', phone: '09123456789' },
      salon: { id: 's1', name: 'Salon' },
    } as never)

    const res = await app.request('/api/v1/retention/f1/bale-message', {
      method: 'POST',
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    expect(notifications.sendBaleSafirMessage).toHaveBeenCalledWith({
      phone: '989123456789',
      text: expect.stringContaining('Client عزیز، سلام'),
      requestId: 'retention:f1:bale_safir:v1',
    })
    expect(clientsDb.createClientFollowUpMessageDelivery).toHaveBeenCalledWith({
      salonId: 's1',
      followUpId: 'f1',
      clientId: 'c1',
      provider: 'bale_safir',
      phone: '989123456789',
      requestId: 'retention:f1:bale_safir:v1',
      status: 'sent',
      providerMessageId: 'm1',
      error: null,
      sentByUserId: 'u1',
    })
    expect(await res.json()).toMatchObject({
      delivery: {
        id: 'd1',
        provider: 'bale_safir',
        status: 'sent',
      },
      result: {
        status: 'sent',
        providerMessageId: 'm1',
      },
    })
  })
})
