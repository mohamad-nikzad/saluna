import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/notifications', () => ({
  listNotificationsForUser: vi.fn(),
  listNotificationsForUserAcrossSalons: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markAllNotificationsReadAcrossSalons: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationReadAcrossSalons: vi.fn(),
  createNotificationForUser: vi.fn(),
  isWebPushConfigured: vi.fn(() => false),
  getMessagingProvider: vi.fn(),
  getBaleConfig: vi.fn(() => null),
  getTelegramConfig: vi.fn(() => null),
  renderAppointmentRequestPending: vi.fn(),
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
  listActiveStaffProfileAccessesForUser: vi.fn(),
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
import {
  listActiveStaffProfileAccessesForUser,
  resolveStaffTenantContext,
} from '@repo/database/staff'

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
  delete process.env.ENABLE_NOTIFICATION_TEST
})

describe('notifications router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/notifications')
    expect(res.status).toBe(401)
  })

  it('GET returns notifications', async () => {
    vi.mocked(notif.listNotificationsForUser).mockResolvedValue([
      { id: 'n1' },
    ] as never)
    const res = await app.request('/api/v1/notifications', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notifications: [{ id: 'n1' }] })
    expect(notif.listNotificationsForUser).toHaveBeenCalledWith({
      salonId: 's1',
      userId: 'u1',
      unreadOnly: false,
    })
  })

  it('GET respects ?unreadOnly=true', async () => {
    vi.mocked(notif.listNotificationsForUser).mockResolvedValue([] as never)
    const res = await app.request('/api/v1/notifications?unreadOnly=true', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(notif.listNotificationsForUser).toHaveBeenCalledWith({
      salonId: 's1',
      userId: 'u1',
      unreadOnly: true,
    })
  })

  it('POST /read-all returns updated count', async () => {
    vi.mocked(notif.markAllNotificationsRead).mockResolvedValue(3 as never)
    const res = await app.request('/api/v1/notifications/read-all', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, updatedCount: 3 })
  })

  it('POST /:id/read returns notification', async () => {
    vi.mocked(notif.markNotificationRead).mockResolvedValue({
      id: 'n1',
      read: true,
    } as never)
    const res = await app.request('/api/v1/notifications/n1/read', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notification: { id: 'n1', read: true } })
    expect(notif.markNotificationRead).toHaveBeenCalledWith('s1', 'u1', 'n1')
  })

  it('POST /:id/read 404 when missing', async () => {
    vi.mocked(notif.markNotificationRead).mockResolvedValue(undefined as never)
    const res = await app.request('/api/v1/notifications/x/read', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
  })

  it('POST /test 404 when flag disabled', async () => {
    const res = await app.request('/api/v1/notifications/test', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(404)
    expect(notif.createNotificationForUser).not.toHaveBeenCalled()
  })

  it('POST /test creates notification when enabled in non-prod', async () => {
    process.env.ENABLE_NOTIFICATION_TEST = '1'
    vi.mocked(notif.createNotificationForUser).mockResolvedValue({
      id: 'nt',
    } as never)
    const res = await app.request('/api/v1/notifications/test', {
      method: 'POST',
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notification: { id: 'nt' } })
    expect(notif.createNotificationForUser).toHaveBeenCalled()
  })

  it('GET lists staff notifications across all accepted salons, not only current selection', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(null as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'staff-1',
      salonId: 'salon-a',
      staffProfileId: 'profile-a',
      name: 'Staff',
      phone: '09121111111',
      salonStatus: 'active',
    } as never)
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'staff-1' },
    } as never)
    vi.mocked(listActiveStaffProfileAccessesForUser).mockResolvedValue([
      {
        salonId: 'salon-a',
        staffProfileId: 'profile-a',
        profileActive: true,
      },
      {
        salonId: 'salon-b',
        staffProfileId: 'profile-b',
        profileActive: true,
      },
      {
        salonId: 'salon-inactive',
        staffProfileId: 'profile-x',
        profileActive: false,
      },
    ] as never)
    vi.mocked(notif.listNotificationsForUserAcrossSalons).mockResolvedValue([
      { id: 'n-a', salonId: 'salon-a' },
      { id: 'n-b', salonId: 'salon-b' },
    ] as never)

    const res = await app.request('/api/v1/notifications', {
      headers: {
        Authorization: 'Bearer testtoken',
        'X-Saluna-Salon-Id': 'salon-a',
      },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      notifications: [
        { id: 'n-a', salonId: 'salon-a' },
        { id: 'n-b', salonId: 'salon-b' },
      ],
    })
    expect(notif.listNotificationsForUserAcrossSalons).toHaveBeenCalledWith({
      userId: 'staff-1',
      salonIds: ['salon-a', 'salon-b'],
      unreadOnly: false,
    })
    expect(notif.listNotificationsForUser).not.toHaveBeenCalled()
  })

  it('POST /:id/read for staff marks across accepted salons', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(null as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'staff-1',
      salonId: 'salon-a',
      staffProfileId: 'profile-a',
      name: 'Staff',
      phone: '09121111111',
      salonStatus: 'active',
    } as never)
    vi.mocked(authServer.api.getSession).mockResolvedValue({
      user: { id: 'staff-1' },
    } as never)
    vi.mocked(listActiveStaffProfileAccessesForUser).mockResolvedValue([
      {
        salonId: 'salon-a',
        staffProfileId: 'profile-a',
        profileActive: true,
      },
      {
        salonId: 'salon-b',
        staffProfileId: 'profile-b',
        profileActive: true,
      },
    ] as never)
    vi.mocked(notif.markNotificationReadAcrossSalons).mockResolvedValue({
      id: 'n-b',
      salonId: 'salon-b',
    } as never)

    const res = await app.request('/api/v1/notifications/n-b/read', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer testtoken',
        'X-Saluna-Salon-Id': 'salon-a',
      },
    })

    expect(res.status).toBe(200)
    expect(notif.markNotificationReadAcrossSalons).toHaveBeenCalledWith(
      'staff-1',
      'n-b',
      ['salon-a', 'salon-b'],
    )
    expect(notif.markNotificationRead).not.toHaveBeenCalled()
  })
})
