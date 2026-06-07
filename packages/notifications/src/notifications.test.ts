import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createNotificationForUser: vi.fn(),
  dispatchNotification: vi.fn(),
  findAccountByUserAndProvider: vi.fn(),
  getEnabledMessagingProvidersForSalon: vi.fn(),
  getBaleSafirConfig: vi.fn(),
  getUserById: vi.fn(),
  sendBaleSafirMessage: vi.fn(),
  sendSmsNotification: vi.fn(),
  getNotificationPreferences: vi.fn(),
}))

vi.mock('@repo/database/notifications', () => ({
  createNotificationForUser: mocks.createNotificationForUser,
  dispatchNotification: mocks.dispatchNotification,
  getNotificationPreferences: mocks.getNotificationPreferences,
  listNotificationsForUser: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

vi.mock('@repo/database/messaging', () => ({
  findAccountByUserAndProvider: mocks.findAccountByUserAndProvider,
}))

vi.mock('@repo/database/public', () => ({
  getEnabledMessagingProvidersForSalon: mocks.getEnabledMessagingProvidersForSalon,
}))

vi.mock('@repo/database/auth-users', () => ({
  getUserById: mocks.getUserById,
}))

vi.mock('./sms', () => ({
  sendSmsNotification: mocks.sendSmsNotification,
}))

vi.mock('./providers/bale-safir', () => ({
  getBaleSafirConfig: mocks.getBaleSafirConfig,
  sendBaleSafirMessage: mocks.sendBaleSafirMessage,
}))

import { createNotificationForUser } from './notifications'
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
  mocks.getEnabledMessagingProvidersForSalon.mockResolvedValue(['telegram'])
  mocks.getBaleSafirConfig.mockReturnValue(null)
  mocks.getUserById.mockResolvedValue({
    id: 'user-1',
    salonId: 'salon-1',
    name: 'Staff',
    fullName: 'Staff',
    nickname: null,
    phone: '09123456789',
    role: 'staff',
    color: 'rose',
    createdAt: new Date(),
  })
  mocks.sendBaleSafirMessage.mockResolvedValue({
    status: 'sent',
    providerMessageId: 'safir-1',
    phone: '989123456789',
  })
  mocks.sendSmsNotification.mockResolvedValue({
    status: 'skipped',
    provider: null,
    providerMessageId: null,
    error: 'sms_provider_not_configured',
  })
  mocks.findAccountByUserAndProvider.mockResolvedValue(undefined)
  mocks.getNotificationPreferences.mockResolvedValue({
    salonId: 'salon-1',
    userId: 'user-1',
    appointmentAlertsEnabled: true,
    localAlertsEnabled: true,
    smsAlertsEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

afterEach(() => {
  vi.clearAllMocks()
  _resetMessagingProviderRegistry()
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
      buildAccountLinkUrl: () => null,
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
      buildAccountLinkUrl: () => null,
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

  it('loads salon enabled providers once per notification', async () => {
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
      send: vi.fn().mockResolvedValue({ status: 'sent' }),
    })
    registerMessagingProvider({
      id: 'whatsapp',
      displayName: 'WhatsApp',
      supportsInlineButtons: false,
      supportsInbound: false,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
      send: vi.fn().mockResolvedValue({ status: 'sent' }),
    })
    mocks.getEnabledMessagingProvidersForSalon.mockResolvedValue(['telegram', 'whatsapp'])

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(mocks.getEnabledMessagingProvidersForSalon).toHaveBeenCalledTimes(1)
    expect(mocks.getEnabledMessagingProvidersForSalon).toHaveBeenCalledWith('salon-1')
  })

  it('skips a provider when the salon has it disabled', async () => {
    const send = vi.fn()
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
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
    mocks.getEnabledMessagingProvidersForSalon.mockResolvedValue([])

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

  it('skips appointment-request messaging when appointment alerts are disabled', async () => {
    const send = vi.fn()
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
      send,
    })
    mocks.createNotificationForUser.mockResolvedValue({
      ...notification,
      type: 'appointment_request_pending',
    })
    mocks.getNotificationPreferences.mockResolvedValue({
      salonId: 'salon-1',
      userId: 'user-1',
      appointmentAlertsEnabled: false,
      localAlertsEnabled: true,
      smsAlertsEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_request_pending',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(send).not.toHaveBeenCalled()
    const tgCall = mocks.dispatchNotification.mock.calls.find((c) => c[1] === 'telegram')!
    expect(tgCall[2]).toBe('skipped')
    expect(tgCall[3]).toMatchObject({ error: 'appointment_alerts_disabled' })
  })

  it('delivers non-appointment-request messaging when appointment alerts are disabled', async () => {
    const send = vi.fn().mockResolvedValue({ status: 'sent', providerMessageId: 'tg-1' })
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
      send,
    })
    mocks.getNotificationPreferences.mockResolvedValue({
      salonId: 'salon-1',
      userId: 'user-1',
      appointmentAlertsEnabled: false,
      localAlertsEnabled: true,
      smsAlertsEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
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

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'T',
      body: 'B',
      route: '/x',
    })

    expect(send).toHaveBeenCalled()
    const tgCall = mocks.dispatchNotification.mock.calls.find((c) => c[1] === 'telegram')!
    expect(tgCall[2]).toBe('sent')
  })

  it('passes messagingButtons from input to the provider', async () => {
    const send = vi.fn().mockResolvedValue({ status: 'sent', providerMessageId: 'tg-1' })
    registerMessagingProvider({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
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

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_request_pending',
      title: 'T',
      body: 'B',
      route: '/x',
      messagingButtons: [[{ label: 'Open', url: 'https://app.example/requests/1' }]],
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: [[{ label: 'Open', url: 'https://app.example/requests/1' }]],
      })
    )
  })

  it('does not send Safir when a linked enabled Bale bot account exists', async () => {
    const send = vi.fn().mockResolvedValue({
      status: 'sent',
      providerMessageId: 'bale-bot-1',
    })
    registerMessagingProvider({
      id: 'bale',
      displayName: 'Bale',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: () => null,
      send,
    })
    mocks.getEnabledMessagingProvidersForSalon.mockResolvedValue(['bale'])
    mocks.getBaleSafirConfig.mockReturnValue({
      apiAccessKey: 'access-key',
      botId: '123456',
    })
    mocks.findAccountByUserAndProvider.mockResolvedValue({
      id: 'acc-bale-1',
      userId: 'user-1',
      provider: 'bale',
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
      title: 'نوبت جدید',
      body: 'مشتری، سرویس، 2026-06-07 ساعت 10:00',
      route: '/x',
    })

    expect(send).toHaveBeenCalled()
    expect(mocks.sendBaleSafirMessage).not.toHaveBeenCalled()
    const baleCalls = mocks.dispatchNotification.mock.calls.filter(
      (c) => c[1] === 'bale',
    )
    expect(baleCalls).toHaveLength(1)
    expect(baleCalls[0]![2]).toBe('sent')
    expect(baleCalls[0]![3]).toMatchObject({ provider: 'bale' })
  })

  it('sends appointment-created Safir fallback when Bale is enabled and the staff has no linked Bale account', async () => {
    mocks.createNotificationForUser.mockResolvedValue({
      ...notification,
      title: 'نوبت جدید',
      body: 'مشتری، سرویس، 2026-06-07 ساعت 10:00',
    })
    mocks.getEnabledMessagingProvidersForSalon.mockResolvedValue(['bale'])
    mocks.getBaleSafirConfig.mockReturnValue({
      apiAccessKey: 'access-key',
      botId: '123456',
    })

    await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'نوبت جدید',
      body: 'مشتری، سرویس، 2026-06-07 ساعت 10:00',
      route: '/x',
    })

    expect(mocks.getUserById).toHaveBeenCalledWith('user-1')
    expect(mocks.sendBaleSafirMessage).toHaveBeenCalledWith({
      phone: '09123456789',
      text: 'نوبت جدید\nمشتری، سرویس، 2026-06-07 ساعت 10:00',
      requestId: 'notification:n-1:bale_safir',
    })
    const safirCall = mocks.dispatchNotification.mock.calls.find(
      (c) => c[1] === 'bale' && c[3]?.provider === 'bale_safir',
    )!
    expect(safirCall[2]).toBe('sent')
    expect(safirCall[3]).toMatchObject({
      provider: 'bale_safir',
      providerMessageId: 'safir-1',
    })
  })

  it('records Safir NotBaleUser as failed without blocking appointment-created notification creation', async () => {
    mocks.getEnabledMessagingProvidersForSalon.mockResolvedValue(['bale'])
    mocks.getBaleSafirConfig.mockReturnValue({
      apiAccessKey: 'access-key',
      botId: '123456',
    })
    mocks.sendBaleSafirMessage.mockResolvedValue({
      status: 'failed',
      error: 'not_bale_user',
      phone: '989123456789',
    })

    const result = await createNotificationForUser({
      salonId: 'salon-1',
      userId: 'user-1',
      type: 'appointment_created',
      title: 'نوبت جدید',
      body: 'مشتری، سرویس، 2026-06-07 ساعت 10:00',
      route: '/x',
    })

    expect(result).toEqual(notification)
    const safirCall = mocks.dispatchNotification.mock.calls.find(
      (c) => c[1] === 'bale' && c[3]?.provider === 'bale_safir',
    )!
    expect(safirCall[2]).toBe('failed')
    expect(safirCall[3]).toMatchObject({
      provider: 'bale_safir',
      error: 'not_bale_user',
    })
  })
})
