import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createNotificationForUser: vi.fn(),
  dispatchNotification: vi.fn(),
  findAccountByUserAndProvider: vi.fn(),
  sendSmsNotification: vi.fn(),
}))

vi.mock('@repo/database/notifications', () => ({
  createNotificationForUser: mocks.createNotificationForUser,
  dispatchNotification: mocks.dispatchNotification,
  getNotificationPreferences: vi.fn(),
  listNotificationsForUser: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

vi.mock('@repo/database/messaging', () => ({
  findAccountByUserAndProvider: mocks.findAccountByUserAndProvider,
}))

vi.mock('./sms', () => ({
  sendSmsNotification: mocks.sendSmsNotification,
}))

import { createNotificationForUser, setSalonMessagingProviderGate } from './notifications'
import {
  _resetMessagingProviderRegistry,
  registerMessagingProvider,
} from './providers/registry'
import type { MessagingProvider } from './providers/types'

const notification = {
  id: 'n-1',
  salonId: 'salon-1',
  userId: 'user-1',
  type: 'appointment_created' as const,
  title: 'T',
  body: 'B',
  route: '/x',
  data: {},
  readAt: null,
  createdAt: new Date('2026-05-31T10:00:00.000Z'),
}

beforeEach(() => {
  mocks.createNotificationForUser.mockResolvedValue(notification)
  mocks.dispatchNotification.mockResolvedValue(undefined)
  mocks.sendSmsNotification.mockResolvedValue({
    status: 'skipped',
    provider: null,
    providerMessageId: null,
    error: 'sms_provider_not_configured',
  })
  mocks.findAccountByUserAndProvider.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
  _resetMessagingProviderRegistry()
  setSalonMessagingProviderGate(undefined)
})

describe('createNotificationForUser', () => {
  it('records in_app + sms with an empty provider registry (legacy behavior)', async () => {
    const result = await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(result).toEqual(notification)
    const calls = mocks.dispatchNotification.mock.calls.map((c) => c[1])
    expect(calls).toEqual(['in_app', 'sms'])
  })

  it('dispatches to a registered + configured provider when the user has a linked account', async () => {
    const send = vi.fn().mockResolvedValue({
      status: 'sent',
      providerMessageId: 'tg-1',
    })
    const provider: MessagingProvider = {
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      send,
    }
    registerMessagingProvider(provider)
    mocks.findAccountByUserAndProvider.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      provider: 'telegram',
      externalId: 'chat-9',
      displayName: null,
      enabled: true,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'n-1',
        externalId: 'chat-9',
        title: 'T',
        body: 'B',
      })
    )
    const channels = mocks.dispatchNotification.mock.calls.map((c) => c[1])
    expect(channels).toEqual(['in_app', 'sms', 'telegram'])
    const tgCall = mocks.dispatchNotification.mock.calls.find((c) => c[1] === 'telegram')!
    expect(tgCall[2]).toBe('sent')
    expect(tgCall[3]).toMatchObject({ provider: 'telegram', providerMessageId: 'tg-1' })
  })

  it('skips a provider when the user has no linked account', async () => {
    const send = vi.fn()
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      send,
    })

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(send).not.toHaveBeenCalled()
    const tgCall = mocks.dispatchNotification.mock.calls.find((c) => c[1] === 'telegram')!
    expect(tgCall[2]).toBe('skipped')
    expect(tgCall[3]).toMatchObject({ error: 'not_linked' })
  })

  it('skips a provider when the salon gate denies it', async () => {
    const send = vi.fn()
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      send,
    })
    mocks.findAccountByUserAndProvider.mockResolvedValue({
      id: 'acc-1',
      userId: 'user-1',
      provider: 'telegram',
      externalId: 'chat-9',
      displayName: null,
      enabled: true,
      linkedAt: new Date(),
      updatedAt: new Date(),
    })
    setSalonMessagingProviderGate(async () => false)

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(send).not.toHaveBeenCalled()
    const tgCall = mocks.dispatchNotification.mock.calls.find((c) => c[1] === 'telegram')!
    expect(tgCall[2]).toBe('skipped')
    expect(tgCall[3]).toMatchObject({ error: 'salon_disabled' })
  })
})
