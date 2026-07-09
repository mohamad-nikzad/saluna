import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../factory'

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

vi.mock('@repo/database/support-tickets', () => ({
  addManagerSupportMessage: vi.fn(),
  createSupportTicket: vi.fn(),
  getSalonSupportTicketDetail: vi.fn(),
  getSalonSupportTicketSummary: vi.fn(),
  listSalonSupportTickets: vi.fn(),
  markSupportTicketReadByManager: vi.fn(),
}))

import { auth } from '@repo/auth/server'
import { getManagerMemberForUser, getMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'
import * as supportDb from '@repo/database/support-tickets'
import { supportTicketsRoute } from './support-tickets'

const salonId = '11111111-1111-4111-8111-111111111111'
const userId = '22222222-2222-4222-8222-222222222222'
const ticketId = '33333333-3333-4333-8333-333333333333'
const headers = {
  authorization: 'Bearer test',
  'content-type': 'application/json',
}
const app = new Hono<AppEnv>().route(
  '/api/v1/support-tickets',
  supportTicketsRoute,
)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(auth.api.getSession).mockImplementation(
    async ({ headers }: any) =>
      (headers.get('authorization')
        ? { user: { id: userId, name: 'User Name' } }
        : null) as never,
  )
  vi.mocked(getMemberForUser).mockResolvedValue({
    userId,
    organizationId: salonId,
    role: 'owner',
    name: 'Salon Display Name',
    username: '09120000000',
  })
  vi.mocked(getManagerMemberForUser).mockResolvedValue({
    userId,
    organizationId: salonId,
    role: 'owner',
    name: 'Salon Display Name',
    username: '09120000000',
  })
})

describe('manager support ticket routes', () => {
  it('requires authentication', async () => {
    expect((await app.request('/api/v1/support-tickets')).status).toBe(401)
  })

  it.each([
    ['GET', '/api/v1/support-tickets', undefined],
    [
      'POST',
      '/api/v1/support-tickets',
      { category: 'problem', subject: 'Subject', body: 'Body' },
    ],
    ['GET', '/api/v1/support-tickets/summary', undefined],
    ['GET', `/api/v1/support-tickets/${ticketId}`, undefined],
    [
      'POST',
      `/api/v1/support-tickets/${ticketId}/messages`,
      { body: 'Message' },
    ],
    ['POST', `/api/v1/support-tickets/${ticketId}/read`, undefined],
  ])('rejects unauthenticated access: %s %s', async (method, path, body) => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    expect(
      (
        await app.request(path, {
          method,
          headers: { 'content-type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        })
      ).status,
    ).toBe(401)
  })

  it.each([
    ['GET', '/api/v1/support-tickets', undefined],
    [
      'POST',
      '/api/v1/support-tickets',
      { category: 'problem', subject: 'Subject', body: 'Body' },
    ],
    ['GET', '/api/v1/support-tickets/summary', undefined],
    ['GET', `/api/v1/support-tickets/${ticketId}`, undefined],
    [
      'POST',
      `/api/v1/support-tickets/${ticketId}/messages`,
      { body: 'Message' },
    ],
    ['POST', `/api/v1/support-tickets/${ticketId}/read`, undefined],
  ])('rejects staff: %s %s', async (method, path, body) => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId,
      salonId,
      staffProfileId: 'profile-staff',
      name: 'Staff',
      phone: '09120000000',
      salonStatus: 'active',
    } as never)
    expect(
      (
        await app.request(path, {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        })
      ).status,
    ).toBe(403)
  })

  it('lists only the authenticated salon and serves the static summary route', async () => {
    vi.mocked(supportDb.listSalonSupportTickets).mockResolvedValue({
      items: [],
      pagination: { page: 2 },
    } as never)
    vi.mocked(supportDb.getSalonSupportTicketSummary).mockResolvedValue({
      unreadCount: 3,
    })

    expect(
      (
        await app.request('/api/v1/support-tickets?page=2&pageSize=10', {
          headers,
        })
      ).status,
    ).toBe(200)
    expect(supportDb.listSalonSupportTickets).toHaveBeenCalledWith({
      salonId,
      page: 2,
      pageSize: 10,
    })

    const summary = await app.request('/api/v1/support-tickets/summary', {
      headers,
    })
    expect(summary.status).toBe(200)
    expect(await summary.json()).toEqual({ unreadCount: 3 })
    expect(supportDb.getSalonSupportTicketDetail).not.toHaveBeenCalled()
  })

  it('creates with authenticated salon, user, and salon display identity', async () => {
    vi.mocked(supportDb.createSupportTicket).mockResolvedValue({
      ticket: { id: ticketId },
    } as never)

    const response = await app.request('/api/v1/support-tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category: 'question',
        subject: '  Help  ',
        body: '  Details  ',
        salonId: 'attacker',
        authorUserId: 'attacker',
      }),
    })

    expect(response.status).toBe(400)

    const validResponse = await app.request('/api/v1/support-tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category: 'question',
        subject: '  Help  ',
        body: '  Details  ',
      }),
    })
    expect(validResponse.status).toBe(201)
    expect(supportDb.createSupportTicket).toHaveBeenCalledWith({
      salonId,
      submittedByUserId: userId,
      submittedByDisplayName: 'Salon Display Name',
      category: 'question',
      subject: 'Help',
      body: 'Details',
    })
  })

  it.each([
    { category: 'unknown', subject: 'Subject', body: 'Body' },
    { category: 'problem', subject: ' ', body: 'Body' },
    { category: 'problem', subject: 'Subject', body: 'x'.repeat(4_001) },
  ])('rejects invalid create payload %#', async (payload) => {
    const response = await app.request('/api/v1/support-tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    expect(response.status).toBe(400)
  })

  it('keeps detail GET side-effect free and advances read only explicitly', async () => {
    vi.mocked(supportDb.getSalonSupportTicketDetail).mockResolvedValue({
      ticket: { id: ticketId },
    } as never)
    vi.mocked(supportDb.markSupportTicketReadByManager).mockResolvedValue({
      ticketId,
    } as never)

    expect(
      (await app.request(`/api/v1/support-tickets/${ticketId}`, { headers }))
        .status,
    ).toBe(200)
    expect(supportDb.markSupportTicketReadByManager).not.toHaveBeenCalled()

    expect(
      (
        await app.request(`/api/v1/support-tickets/${ticketId}/read`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(200)
    expect(supportDb.markSupportTicketReadByManager).toHaveBeenCalledWith({
      salonId,
      ticketId,
    })
  })

  it('adds a message with authenticated manager identity and returns 404 outside salon scope', async () => {
    vi.mocked(supportDb.addManagerSupportMessage).mockResolvedValue({
      message: { id: 'message-1' },
    } as never)
    const response = await app.request(
      `/api/v1/support-tickets/${ticketId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: '  Follow up  ' }),
      },
    )
    expect(response.status).toBe(201)
    expect(supportDb.addManagerSupportMessage).toHaveBeenCalledWith({
      salonId,
      ticketId,
      authorUserId: userId,
      authorDisplayName: 'Salon Display Name',
      body: 'Follow up',
    })

    vi.mocked(supportDb.addManagerSupportMessage).mockResolvedValue(undefined)
    expect(
      (
        await app.request(`/api/v1/support-tickets/${ticketId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: 'Again' }),
        })
      ).status,
    ).toBe(404)
  })

  it.each([
    {},
    { body: ' ' },
    { body: 'x'.repeat(4_001) },
    { body: 'Message', authorUserId: 'attacker' },
  ])('rejects invalid manager message payload %#', async (payload) => {
    const response = await app.request(
      `/api/v1/support-tickets/${ticketId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
    )
    expect(response.status).toBe(400)
    expect(supportDb.addManagerSupportMessage).not.toHaveBeenCalled()
  })

  it('returns 404 for missing or cross-salon ticket IDs on every scoped operation', async () => {
    vi.mocked(supportDb.getSalonSupportTicketDetail).mockResolvedValue(
      undefined,
    )
    expect(
      (await app.request(`/api/v1/support-tickets/${ticketId}`, { headers }))
        .status,
    ).toBe(404)
    expect(supportDb.getSalonSupportTicketDetail).toHaveBeenCalledWith({
      salonId,
      ticketId,
    })

    vi.mocked(supportDb.addManagerSupportMessage).mockResolvedValue(undefined)
    expect(
      (
        await app.request(`/api/v1/support-tickets/${ticketId}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: 'Message' }),
        })
      ).status,
    ).toBe(404)
    expect(supportDb.addManagerSupportMessage).toHaveBeenCalledWith(
      expect.objectContaining({ salonId, ticketId }),
    )

    vi.mocked(supportDb.markSupportTicketReadByManager).mockResolvedValue(
      undefined,
    )
    expect(
      (
        await app.request(`/api/v1/support-tickets/${ticketId}/read`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(404)
    expect(supportDb.markSupportTicketReadByManager).toHaveBeenCalledWith({
      salonId,
      ticketId,
    })
  })
})
