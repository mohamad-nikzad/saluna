import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({
  getTenantRequest: vi.fn(),
  createNotificationForUser: vi.fn(),
}))

vi.mock('@repo/auth/tenant', () => ({
  getTenantRequest: mocks.getTenantRequest,
}))

vi.mock('@/lib/notifications', () => ({
  createNotificationForUser: mocks.createNotificationForUser,
}))

const user = {
  userId: 'user-a',
  salonId: 'salon-a',
  role: 'staff',
  name: 'Staff A',
  phone: '09120000001',
}

const notification = {
  id: 'notification-a',
  salonId: 'salon-a',
  userId: 'user-a',
  type: 'appointment_created',
  title: 'اعلان تست',
  body: 'این اعلان تست ساخته شد.',
  route: '/notifications',
  data: { source: 'notification_test_route' },
  readAt: null,
  createdAt: new Date('2026-05-12T09:00:00.000Z'),
}

const notificationJson = {
  ...notification,
  createdAt: '2026-05-12T09:00:00.000Z',
}

function request() {
  return new Request('http://test.local/api/notifications/test', {
    method: 'POST',
  })
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mocks.getTenantRequest.mockResolvedValue({ ok: true, user })
  mocks.createNotificationForUser.mockResolvedValue(notification)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/notifications/test', () => {
  it('is unavailable by default', async () => {
    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mocks.getTenantRequest).not.toHaveBeenCalled()
    expect(mocks.createNotificationForUser).not.toHaveBeenCalled()
  })

  it('stays unavailable in production even when the flag is set', async () => {
    vi.stubEnv('ENABLE_NOTIFICATION_TEST', '1')
    vi.stubEnv('VERCEL_ENV', 'production')

    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mocks.getTenantRequest).not.toHaveBeenCalled()
    expect(mocks.createNotificationForUser).not.toHaveBeenCalled()
  })

  it('creates an unread test notification for the current user when enabled', async () => {
    vi.stubEnv('ENABLE_NOTIFICATION_TEST', '1')
    vi.stubEnv('APP_ENV', 'staging')

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.getTenantRequest).toHaveBeenCalledWith(expect.any(Request))
    expect(mocks.createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: 'salon-a',
        userId: 'user-a',
        type: 'appointment_created',
        title: 'اعلان تست',
        route: '/notifications',
        data: expect.objectContaining({
          source: 'notification_test_route',
          route: '/notifications',
        }),
      })
    )
    await expect(readJson(response)).resolves.toEqual({
      notification: notificationJson,
    })
  })
})
