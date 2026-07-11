import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/notifications', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  getMessagingProvider: vi.fn(),
  getBaleConfig: vi.fn(() => null),
  getTelegramConfig: vi.fn(() => null),
  renderAppointmentRequestPending: vi.fn(),
  createNotificationForUser: vi.fn(),
  isWebPushConfigured: vi.fn(() => false),
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

import * as notif from '@repo/notifications'
import { auth as authServer } from '@repo/auth/server'
import {
  getManagerMemberForUser,
  getMemberForUser,
} from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

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
  vi.mocked(authServer.api.getSession).mockImplementation(
    async (args: any) =>
      (args?.headers?.get?.('Authorization')
        ? { user: { id: 'u1' } }
        : null) as never,
  )
  vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
  vi.mocked(resolveStaffTenantContext).mockResolvedValue({
    status: 'ok',
    userId: 'u1',
    salonId: 's1',
    staffProfileId: 'profile-u1',
    name: 'Staff',
    phone: '09120000000',
    salonStatus: 'active',
  } as never)
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
    const res = await app.request('/api/v1/notification-preferences', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      preferences: { appointmentAlertsEnabled: true },
    })
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
    expect(notif.updateNotificationPreferences).toHaveBeenCalledWith(
      's1',
      'u1',
      {
        smsAlertsEnabled: false,
      },
    )
  })

  it('PATCH 400 on non-boolean value', async () => {
    const res = await app.request('/api/v1/notification-preferences', {
      method: 'PATCH',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ smsAlertsEnabled: 'yes' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'مقدار تنظیمات اعلان نامعتبر است',
    })
  })
})
