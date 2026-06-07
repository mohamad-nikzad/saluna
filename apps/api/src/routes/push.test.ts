import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/notifications', () => ({
  isWebPushConfigured: vi.fn(() => true),
  getMessagingProvider: vi.fn(),
  getBaleConfig: vi.fn(() => null),
  getTelegramConfig: vi.fn(() => null),
  renderAppointmentRequestPending: vi.fn(),
  createNotificationForUser: vi.fn(),
  messagingCommands: {
    handleLinkStart: vi.fn(),
    handleUnlink: vi.fn(),
  },
  sendTelegramMessage: vi.fn(),
  answerTelegramCallback: vi.fn(),
  editTelegramMessageText: vi.fn(),
  editTelegramMessageReplyMarkup: vi.fn(),
  sendBaleMessage: vi.fn(),
  answerBaleCallback: vi.fn(),
  editBaleMessageText: vi.fn(),
  editBaleMessageReplyMarkup: vi.fn(),
  renderBaleBotHtml: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
  persistentReplyKeyboard: vi.fn(() => ({
    keyboard: [],
    is_persistent: true,
    resize_keyboard: true,
  })),
  REPLY_KEYBOARD_LABELS: {
    pending: '📋 درخواست‌های در انتظار',
    today: '📅 امروز',
    notificationSettings: '⚙️ تنظیمات اعلان‌ها',
  },
}))

vi.mock('@repo/database/push', () => ({
  upsertPushSubscription: vi.fn(),
  deletePushSubscriptionForUser: vi.fn(),
}))

vi.mock('@repo/auth/server', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

vi.mock('@repo/database/members', () => ({
  getMemberForUser: vi.fn(),
}))

import { isWebPushConfigured } from '@repo/notifications'
import * as pushDb from '@repo/database/push'
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

const authHeaders = { Authorization: 'Bearer testtoken' }
const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' }

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
  vi.mocked(isWebPushConfigured).mockReturnValue(true)
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pk-test'
})

describe('push router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/push/config')
    expect(res.status).toBe(401)
  })

  it('GET /config returns key when configured', async () => {
    const res = await app.request('/api/v1/push/config', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ configured: true, publicKey: 'pk-test' })
  })

  it('GET /config returns null key when not configured', async () => {
    vi.mocked(isWebPushConfigured).mockReturnValue(false)
    const res = await app.request('/api/v1/push/config', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ configured: false, publicKey: null })
  })

  it('POST /subscribe 503 when not configured', async () => {
    vi.mocked(isWebPushConfigured).mockReturnValue(false)
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(503)
  })

  it('POST /subscribe 400 on invalid body', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ subscription: { endpoint: '' } }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /subscribe persists subscription', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://example.com/ep',
          keys: { p256dh: 'p', auth: 'a' },
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(pushDb.upsertPushSubscription).toHaveBeenCalledWith('u1', 's1', {
      endpoint: 'https://example.com/ep',
      p256dh: 'p',
      auth: 'a',
    })
  })

  it('DELETE /subscribe 400 on invalid body', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('DELETE /subscribe removes subscription', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({ endpoint: 'https://example.com/ep' }),
    })
    expect(res.status).toBe(200)
    expect(pushDb.deletePushSubscriptionForUser).toHaveBeenCalledWith(
      'u1',
      's1',
      'https://example.com/ep',
    )
  })
})
