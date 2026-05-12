import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSmsNotification } from './sms'

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getNotificationPreferences: vi.fn(),
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: mocks.getUserById,
}))

vi.mock('@repo/database/notifications', () => ({
  getNotificationPreferences: mocks.getNotificationPreferences,
}))

const notification = {
  id: 'notification-a',
  salonId: 'salon-a',
  userId: 'user-a',
  type: 'appointment_created' as const,
  title: 'نوبت جدید',
  body: 'اعلان تست',
  route: '/calendar',
  data: { appointmentId: 'appointment-a' },
  readAt: null,
  createdAt: new Date('2026-05-12T10:00:00.000Z'),
}

describe('sendSmsNotification', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    mocks.getUserById.mockReset()
    mocks.getNotificationPreferences.mockReset()
  })

  it('skips cleanly when no SMS provider is configured', async () => {
    await expect(sendSmsNotification(notification)).resolves.toEqual({
      status: 'skipped',
      provider: null,
      error: 'sms_provider_not_configured',
    })
    expect(mocks.getNotificationPreferences).not.toHaveBeenCalled()
    expect(mocks.getUserById).not.toHaveBeenCalled()
  })
})
