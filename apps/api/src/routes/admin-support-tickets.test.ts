import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../factory'

vi.mock('@repo/auth/server', () => {
  const auth = { api: { getSession: vi.fn() } }
  return { auth, adminAuth: auth }
})
vi.mock('../env', () => ({
  getEnv: () => ({
    PLATFORM_ADMIN_BOOTSTRAP_PHONES: [],
    ADMIN_DATA_SOURCE: 'local',
  }),
}))
vi.mock('@repo/database/admin', () => ({
  bootstrapPlatformOwnerIfNeeded: vi.fn(),
  createAdminAuditEvent: vi.fn(),
  getPlatformAdminForUser: vi.fn(),
  getUserPhoneForPlatformBootstrap: vi.fn(),
}))
vi.mock('@repo/database/support-tickets', () => ({
  addPlatformSupportMessage: vi.fn(),
  getAdminSupportTicketDetail: vi.fn(),
  getAdminSupportTicketSummary: vi.fn(),
  listAdminSupportTickets: vi.fn(),
  markSupportTicketReadByPlatform: vi.fn(),
  resolveSupportTicket: vi.fn(),
}))
vi.mock('@repo/notifications', () => ({
  notifyManagersOfSupportReply: vi.fn(),
}))

import { auth } from '@repo/auth/server'
import {
  createAdminAuditEvent,
  getPlatformAdminForUser,
} from '@repo/database/admin'
import * as supportDb from '@repo/database/support-tickets'
import { notifyManagersOfSupportReply } from '@repo/notifications'
import { adminSupportTicketsRoute } from './admin-support-tickets'

const ticketId = '11111111-1111-4111-8111-111111111111'
const messageId = '22222222-2222-4222-8222-222222222222'
const salonId = '33333333-3333-4333-8333-333333333333'
const actorUserId = '44444444-4444-4444-8444-444444444444'
const app = new Hono<AppEnv>().route(
  '/api/v1/admin/support-tickets',
  adminSupportTicketsRoute,
)
const headers = {
  authorization: 'Bearer test',
  'content-type': 'application/json',
  'x-request-id': 'request-1',
  'x-forwarded-for': '203.0.113.5, 10.0.0.1',
  'user-agent': 'vitest',
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: actorUserId, name: 'Real Admin' },
  } as never)
  vi.mocked(getPlatformAdminForUser).mockResolvedValue({
    id: 'admin-id',
    userId: actorUserId,
    role: 'platform_admin',
    active: true,
  })
  vi.mocked(supportDb.listAdminSupportTickets).mockResolvedValue({
    items: [],
    pagination: {},
  } as never)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('admin support ticket routes', () => {
  it('requires authentication', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    expect((await app.request('/api/v1/admin/support-tickets')).status).toBe(
      401,
    )
  })

  it.each([
    ['GET', '/api/v1/admin/support-tickets', undefined],
    ['GET', '/api/v1/admin/support-tickets/summary', undefined],
    ['GET', `/api/v1/admin/support-tickets/${ticketId}`, undefined],
    ['POST', `/api/v1/admin/support-tickets/${ticketId}/read`, undefined],
    [
      'POST',
      `/api/v1/admin/support-tickets/${ticketId}/messages`,
      { body: 'Answer' },
    ],
    ['POST', `/api/v1/admin/support-tickets/${ticketId}/resolve`, undefined],
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

  it('serves summary before the ticket parameter route', async () => {
    vi.mocked(supportDb.getAdminSupportTicketSummary).mockResolvedValue({
      unresolvedCount: 4,
      unreadCount: 2,
    })
    const response = await app.request(
      '/api/v1/admin/support-tickets/summary',
      { headers },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      unresolvedCount: 4,
      unreadCount: 2,
    })
    expect(supportDb.getAdminSupportTicketDetail).not.toHaveBeenCalled()
  })

  it('parses inbox filters and defaults through the shared schema', async () => {
    const defaultResponse = await app.request('/api/v1/admin/support-tickets', {
      headers,
    })
    expect(defaultResponse.status).toBe(200)
    expect(supportDb.listAdminSupportTickets).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 25,
    })

    const response = await app.request(
      `/api/v1/admin/support-tickets?page=2&pageSize=50&status=open&category=problem&salonId=${salonId}&search=%20needle%20&scope=all`,
      { headers },
    )
    expect(response.status).toBe(200)
    expect(supportDb.listAdminSupportTickets).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      status: 'open',
      category: 'problem',
      salonId,
      search: 'needle',
      scope: 'all',
    })
  })

  it.each([
    '/api/v1/admin/support-tickets?page=0',
    '/api/v1/admin/support-tickets?pageSize=101',
    '/api/v1/admin/support-tickets?status=bogus',
    '/api/v1/admin/support-tickets?salonId=not-a-uuid',
  ])('rejects invalid inbox query %s', async (path) => {
    expect((await app.request(path, { headers })).status).toBe(400)
  })

  it.each(['platform_owner', 'platform_admin', 'platform_support'] as const)(
    '%s replies with the real actor and resilient fanout',
    async (role) => {
      vi.mocked(getPlatformAdminForUser).mockResolvedValue({
        id: 'admin-id',
        userId: actorUserId,
        role,
        active: true,
      })
      vi.mocked(supportDb.addPlatformSupportMessage).mockResolvedValue({
        previousStatus: 'open',
        resultingStatus: 'waiting_for_manager',
        ticket: { id: ticketId, salonId },
        message: { id: messageId },
      } as never)
      vi.mocked(createAdminAuditEvent).mockResolvedValue({
        id: 'audit-1',
      } as never)
      vi.mocked(notifyManagersOfSupportReply).mockRejectedValue(
        new Error('fanout failed'),
      )

      const response = await app.request(
        `/api/v1/admin/support-tickets/${ticketId}/messages`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: 'Answer' }),
        },
      )

      expect(response.status).toBe(201)
      expect(supportDb.addPlatformSupportMessage).toHaveBeenCalledWith({
        ticketId,
        authorUserId: actorUserId,
        authorDisplayName: 'Real Admin',
        body: 'Answer',
        resolveAfter: false,
      })
      expect(createAdminAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId,
          actorPlatformRole: role,
          action: 'support_ticket.message_created',
          targetType: 'support_message',
          targetId: messageId,
          salonId,
          metadata: {
            ticketId,
            salonId,
            previousStatus: 'open',
            resultingStatus: 'waiting_for_manager',
            resolveAfter: false,
          },
          requestId: 'request-1',
          ip: '203.0.113.5',
          userAgent: 'vitest',
        }),
      )
      expect(
        JSON.stringify(vi.mocked(createAdminAuditEvent).mock.calls),
      ).not.toContain('Answer')
      expect(notifyManagersOfSupportReply).toHaveBeenCalledWith({
        salonId,
        ticketId,
      })
    },
  )

  it('viewer reads and marks read but cannot reply or resolve', async () => {
    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'viewer-id',
      userId: actorUserId,
      role: 'platform_viewer',
      active: true,
    })
    vi.mocked(supportDb.getAdminSupportTicketDetail).mockResolvedValue({
      ticket: { id: ticketId },
    } as never)
    vi.mocked(supportDb.markSupportTicketReadByPlatform).mockResolvedValue({
      ticketId,
    } as never)

    expect(
      (
        await app.request(`/api/v1/admin/support-tickets/${ticketId}`, {
          headers,
        })
      ).status,
    ).toBe(200)
    expect(supportDb.markSupportTicketReadByPlatform).not.toHaveBeenCalled()
    expect(
      (
        await app.request(`/api/v1/admin/support-tickets/${ticketId}/read`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(200)
    expect(
      (await app.request('/api/v1/admin/support-tickets', { headers })).status,
    ).toBe(200)
    expect(
      (await app.request('/api/v1/admin/support-tickets/summary', { headers }))
        .status,
    ).toBe(200)
    expect(
      (
        await app.request(
          `/api/v1/admin/support-tickets/${ticketId}/messages`,
          { method: 'POST', headers, body: JSON.stringify({ body: 'No' }) },
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await app.request(`/api/v1/admin/support-tickets/${ticketId}/resolve`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(403)
  })

  it.each(['platform_owner', 'platform_admin', 'platform_support'] as const)(
    '%s can resolve',
    async (role) => {
      vi.mocked(getPlatformAdminForUser).mockResolvedValue({
        id: 'admin-id',
        userId: actorUserId,
        role,
        active: true,
      })
      vi.mocked(supportDb.resolveSupportTicket).mockResolvedValue({
        changed: true,
        previousStatus: 'open',
        resultingStatus: 'resolved',
        ticket: { id: ticketId, salonId },
      } as never)
      expect(
        (
          await app.request(
            `/api/v1/admin/support-tickets/${ticketId}/resolve`,
            { method: 'POST', headers },
          )
        ).status,
      ).toBe(200)
    },
  )

  it.each([
    {},
    { body: ' ' },
    { body: 'x'.repeat(4_001) },
    { body: 'valid', resolveAfter: 'yes' },
    { body: 'valid', authorUserId: 'attacker' },
  ])('rejects invalid reply payload %#', async (payload) => {
    expect(
      (
        await app.request(
          `/api/v1/admin/support-tickets/${ticketId}/messages`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
        )
      ).status,
    ).toBe(400)
  })

  it('uses one atomic reply command for reply-and-resolve and writes both audits', async () => {
    vi.mocked(supportDb.addPlatformSupportMessage).mockResolvedValue({
      previousStatus: 'open',
      resultingStatus: 'resolved',
      ticket: { id: ticketId, salonId },
      message: { id: messageId },
    } as never)
    const response = await app.request(
      `/api/v1/admin/support-tickets/${ticketId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: 'Done', resolveAfter: true }),
      },
    )
    expect(response.status).toBe(201)
    expect(supportDb.addPlatformSupportMessage).toHaveBeenCalledTimes(1)
    expect(supportDb.resolveSupportTicket).not.toHaveBeenCalled()
    expect(
      vi
        .mocked(createAdminAuditEvent)
        .mock.calls.map(([input]) => input.action),
    ).toEqual([
      'support_ticket.message_created',
      'support_ticket.status_changed',
    ])
    expect(vi.mocked(createAdminAuditEvent).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        metadata: {
          previousStatus: 'open',
          resultingStatus: 'resolved',
          source: 'reply_and_resolve',
        },
      }),
    )
  })

  it('does not add status audit for an ordinary open-to-waiting reply, but audits a resolved-ticket reopen', async () => {
    vi.mocked(supportDb.addPlatformSupportMessage).mockResolvedValue({
      previousStatus: 'open',
      resultingStatus: 'waiting_for_manager',
      ticket: { id: ticketId, salonId },
      message: { id: messageId },
    } as never)
    await app.request(`/api/v1/admin/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: 'Answer' }),
    })
    expect(
      vi
        .mocked(createAdminAuditEvent)
        .mock.calls.map(([input]) => input.action),
    ).toEqual(['support_ticket.message_created'])

    vi.clearAllMocks()
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: actorUserId, name: 'Real Admin' },
    } as never)
    vi.mocked(getPlatformAdminForUser).mockResolvedValue({
      id: 'admin-id',
      userId: actorUserId,
      role: 'platform_admin',
      active: true,
    })
    vi.mocked(supportDb.addPlatformSupportMessage).mockResolvedValue({
      previousStatus: 'resolved',
      resultingStatus: 'open',
      ticket: { id: ticketId, salonId },
      message: { id: messageId },
    } as never)
    await app.request(`/api/v1/admin/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: 'Reopen' }),
    })
    expect(vi.mocked(createAdminAuditEvent).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        action: 'support_ticket.status_changed',
        metadata: {
          previousStatus: 'resolved',
          resultingStatus: 'open',
          source: 'reply',
        },
      }),
    )
  })

  it('audits resolve-only only when status changed and returns 404 when missing', async () => {
    vi.mocked(supportDb.resolveSupportTicket).mockResolvedValue({
      changed: false,
      previousStatus: 'resolved',
      resultingStatus: 'resolved',
      ticket: { id: ticketId, salonId },
    } as never)
    expect(
      (
        await app.request(`/api/v1/admin/support-tickets/${ticketId}/resolve`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(200)
    expect(createAdminAuditEvent).not.toHaveBeenCalled()
    expect(notifyManagersOfSupportReply).not.toHaveBeenCalled()

    vi.mocked(supportDb.resolveSupportTicket).mockResolvedValue({
      changed: true,
      previousStatus: 'waiting_for_manager',
      resultingStatus: 'resolved',
      ticket: { id: ticketId, salonId },
    } as never)
    await app.request(`/api/v1/admin/support-tickets/${ticketId}/resolve`, {
      method: 'POST',
      headers,
    })
    expect(createAdminAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        actorPlatformRole: 'platform_admin',
        action: 'support_ticket.status_changed',
        metadata: {
          previousStatus: 'waiting_for_manager',
          resultingStatus: 'resolved',
          source: 'resolve',
        },
      }),
    )
    expect(
      JSON.stringify(vi.mocked(createAdminAuditEvent).mock.calls),
    ).not.toContain('Answer')
    expect(notifyManagersOfSupportReply).not.toHaveBeenCalled()

    vi.mocked(supportDb.getAdminSupportTicketDetail).mockResolvedValue(
      undefined,
    )
    expect(
      (
        await app.request(`/api/v1/admin/support-tickets/${ticketId}`, {
          headers,
        })
      ).status,
    ).toBe(404)
  })

  it.each([
    ['GET', `/api/v1/admin/support-tickets/${ticketId}`, undefined],
    ['POST', `/api/v1/admin/support-tickets/${ticketId}/read`, undefined],
    [
      'POST',
      `/api/v1/admin/support-tickets/${ticketId}/messages`,
      { body: 'Answer' },
    ],
    ['POST', `/api/v1/admin/support-tickets/${ticketId}/resolve`, undefined],
  ])('returns 404 for missing ticket: %s %s', async (method, path, body) => {
    vi.mocked(supportDb.getAdminSupportTicketDetail).mockResolvedValue(
      undefined,
    )
    vi.mocked(supportDb.markSupportTicketReadByPlatform).mockResolvedValue(
      undefined,
    )
    vi.mocked(supportDb.addPlatformSupportMessage).mockResolvedValue(undefined)
    vi.mocked(supportDb.resolveSupportTicket).mockResolvedValue(undefined)
    expect(
      (
        await app.request(path, {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        })
      ).status,
    ).toBe(404)
  })
})
