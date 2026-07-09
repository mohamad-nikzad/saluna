import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@repo/notifications', () => ({
  getMessagingProvider: vi.fn(),
  listConfiguredMessagingProviders: vi.fn(),
  getBaleConfig: vi.fn(),
  getTelegramConfig: vi.fn(),
  listNotificationsForUser: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  createNotificationForUser: vi.fn(),
  isWebPushConfigured: vi.fn(() => false),
  renderAppointmentRequestPending: vi.fn(),
  messagingCommands: {
    handleLinkStart: vi.fn(),
    handleUnlink: vi.fn(),
    handleApprovalCallback: vi.fn(),
    handleRejectionCallback: vi.fn(),
    handleAssignCallback: vi.fn(),
    handleBackCallback: vi.fn(),
    handlePendingCommand: vi.fn(),
    handleTodayCommand: vi.fn(),
    handleHelpCommand: vi.fn(),
  },
  sendTelegramMessage: vi.fn(),
  answerTelegramCallback: vi.fn(),
  editTelegramMessageText: vi.fn(),
  editTelegramMessageReplyMarkup: vi.fn(),
  sendBaleMessage: vi.fn(),
  answerBaleCallback: vi.fn(),
  editBaleMessageText: vi.fn(),
  editBaleMessageReplyMarkup: vi.fn(),
  renderBaleBotHtml: vi.fn((html: string) =>
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  ),
  persistentReplyKeyboard: vi.fn(() => ({
    keyboard: [[{ text: '📋' }]],
    is_persistent: true,
    resize_keyboard: true,
  })),
  REPLY_KEYBOARD_LABELS: {
    pending: '📋 درخواست‌های در انتظار',
    today: '📅 امروز',
    notificationSettings: '⚙️ تنظیمات اعلان‌ها',
  },
}))

vi.mock('@repo/database/messaging', () => ({
  checkMessagingLinkRateLimit: vi.fn(),
  createLinkToken: vi.fn(),
  deleteAccount: vi.fn(),
  listAccountsForUser: vi.fn(),
  setAccountEnabled: vi.fn(),
}))

vi.mock('@repo/database/public', () => ({
  getEnabledMessagingProvidersForSalon: vi.fn(),
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
import * as messagingDb from '@repo/database/messaging'
import { auth as authServer } from '@repo/auth/server'
import { getManagerMemberForUser, getMemberForUser } from '@repo/database/members'
import { resolveStaffTenantContext } from '@repo/database/staff'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://stub'
process.env.JWT_SECRET = 'test-secret'
process.env.TELEGRAM_BOT_USERNAME = 'TestBot'

const { app } = await import('../app')

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
  vi.mocked(messagingDb.checkMessagingLinkRateLimit).mockResolvedValue({
    allowed: true,
  })
  vi.mocked(notif.getBaleConfig).mockReturnValue(null)
  vi.mocked(notif.getTelegramConfig).mockReturnValue(null)
  vi.mocked(notif.listConfiguredMessagingProviders).mockReturnValue([])
})

describe('messaging router', () => {
  it('401 without auth', async () => {
    const res = await app.request('/api/v1/messaging/accounts')
    expect(res.status).toBe(401)
  })

  it('403 for staff without manage_settings', async () => {
    vi.mocked(getManagerMemberForUser).mockResolvedValue(undefined as never)
    vi.mocked(resolveStaffTenantContext).mockResolvedValue({
      status: 'ok',
      userId: 'u2',
      salonId: 's1',
      staffProfileId: 'profile-u2',
      name: 'Staff',
      phone: '09121111111',
      salonStatus: 'active',
    } as never)
    const res = await app.request('/api/v1/messaging/accounts', {
      headers: authHeaders,
    })
    expect(res.status).toBe(403)
  })

  it('POST /link returns a deep link for telegram', async () => {
    vi.mocked(notif.getMessagingProvider).mockReturnValue({
      id: 'telegram',
      displayName: 'Telegram',
      supportsInlineButtons: true,
      supportsInbound: true,
      isConfigured: () => true,
      buildAccountLinkUrl: (token: string) =>
        `https://t.me/TestBot?start=${token}`,
      send: vi.fn(),
    } as never)
    const expiresAt = new Date(Date.now() + 60000)
    vi.mocked(messagingDb.createLinkToken).mockResolvedValue({
      token: 'tok-1',
      userId: 'u1',
      salonId: 's1',
      provider: 'telegram',
      createdAt: new Date(),
      expiresAt,
      consumedAt: null,
    } as never)

    const res = await app.request('/api/v1/messaging/link', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'telegram' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { deepLink: string; expiresAt: string }
    expect(body.deepLink).toBe('https://t.me/TestBot?start=tok-1')
    expect(body.expiresAt).toBe(expiresAt.toISOString())
  })

  it('POST /link returns 429 when rate-limited', async () => {
    vi.mocked(messagingDb.checkMessagingLinkRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 60_000,
    })
    const res = await app.request('/api/v1/messaging/link', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'telegram' }),
    })
    expect(res.status).toBe(429)
    expect(messagingDb.createLinkToken).not.toHaveBeenCalled()
  })

  it('POST /link 400 when provider not configured', async () => {
    vi.mocked(notif.getMessagingProvider).mockReturnValue(undefined as never)
    const res = await app.request('/api/v1/messaging/link', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'telegram' }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /accounts returns the user accounts', async () => {
    vi.mocked(notif.listConfiguredMessagingProviders).mockReturnValue([
      {
        id: 'telegram',
        displayName: 'Telegram',
        supportsInlineButtons: true,
        supportsInbound: true,
        isConfigured: () => true,
        buildAccountLinkUrl: vi.fn(),
        send: vi.fn(),
      },
      {
        id: 'bale',
        displayName: 'Bale',
        supportsInlineButtons: true,
        supportsInbound: true,
        isConfigured: () => true,
        buildAccountLinkUrl: vi.fn(),
        send: vi.fn(),
      },
    ] as never)
    vi.mocked(messagingDb.listAccountsForUser).mockResolvedValue([
      {
        id: 'acc-1',
        userId: 'u1',
        provider: 'telegram',
        externalId: '42',
        displayName: '@x',
        enabled: true,
        linkedAt: new Date('2026-05-31T10:00:00Z'),
        updatedAt: new Date(),
      },
    ] as never)
    const res = await app.request('/api/v1/messaging/accounts', {
      headers: authHeaders,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      providers: Array<{ id: string; displayName: string }>
      accounts: Array<{ id: string }>
    }
    expect(body.providers).toEqual([
      { id: 'telegram', displayName: 'Telegram' },
      { id: 'bale', displayName: 'Bale' },
    ])
    expect(body.accounts).toHaveLength(1)
    expect(body.accounts[0]!.id).toBe('acc-1')
  })

  it('DELETE /accounts/:id passes ownership through', async () => {
    vi.mocked(messagingDb.deleteAccount).mockResolvedValue(true as never)
    const res = await app.request(
      '/api/v1/messaging/accounts/11111111-1111-1111-1111-111111111111',
      { method: 'DELETE', headers: authHeaders },
    )
    expect(res.status).toBe(200)
    expect(messagingDb.deleteAccount).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'u1',
    )
  })

  it('PATCH /accounts/:id toggles enabled', async () => {
    vi.mocked(messagingDb.setAccountEnabled).mockResolvedValue({
      id: 'acc-1',
      userId: 'u1',
      provider: 'telegram',
      externalId: '42',
      displayName: null,
      enabled: false,
      linkedAt: new Date(),
      updatedAt: new Date(),
    } as never)
    const res = await app.request(
      '/api/v1/messaging/accounts/11111111-1111-1111-1111-111111111111',
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      },
    )
    expect(res.status).toBe(200)
  })
})

describe('messaging telegram webhook', () => {
  it('200 no-op when telegram is not configured', async () => {
    vi.mocked(notif.getTelegramConfig).mockReturnValue(null)
    const res = await app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'any',
      },
      body: JSON.stringify({ update_id: 1 }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleLinkStart).not.toHaveBeenCalled()
  })

  it('200 no-op when secret does not match (does NOT call commands)', async () => {
    vi.mocked(notif.getTelegramConfig).mockReturnValue({
      botToken: 'token',
      botUsername: 'TestBot',
      webhookSecret: 'real-secret',
    })
    const res = await app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong',
      },
      body: JSON.stringify({ update_id: 1 }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleLinkStart).not.toHaveBeenCalled()
  })

  it('routes /start <token> to handleLinkStart with the chat id', async () => {
    vi.mocked(notif.getTelegramConfig).mockReturnValue({
      botToken: 'token',
      botUsername: 'TestBot',
      webhookSecret: 'real-secret',
    })
    vi.mocked(notif.messagingCommands.handleLinkStart).mockResolvedValue({
      status: 'ok',
      message: 'متصل شد',
    } as never)
    vi.mocked(notif.sendTelegramMessage).mockResolvedValue({
      status: 'sent',
    } as never)

    const res = await app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'real-secret',
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          message_id: 99,
          from: { id: 42, username: 'mo', first_name: 'Mo' },
          chat: { id: 42, type: 'private' },
          text: '/start abc-123',
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleLinkStart).toHaveBeenCalledWith({
      provider: 'telegram',
      token: 'abc-123',
      externalId: '42',
      displayName: '@mo',
    })
    expect(notif.sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '42',
        text: 'متصل شد',
        replyMarkup: expect.objectContaining({ is_persistent: true }),
      }),
    )
  })

  it('routes approve callback to handleApprovalCallback and edits the message', async () => {
    vi.mocked(notif.getTelegramConfig).mockReturnValue({
      botToken: 'token',
      botUsername: 'TestBot',
      webhookSecret: 'real-secret',
    })
    vi.mocked(notif.messagingCommands.handleApprovalCallback).mockResolvedValue(
      {
        messageHtml: '✅ تأیید شد',
        replacementKeyboard: null,
        toast: 'تأیید شد',
      } as never,
    )

    const res = await app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'real-secret',
      },
      body: JSON.stringify({
        update_id: 2,
        callback_query: {
          id: 'cb-1',
          from: { id: 42, username: 'mo', first_name: 'Mo' },
          message: { message_id: 99, chat: { id: 42, type: 'private' } },
          data: 'approve:11111111-1111-1111-1111-111111111111',
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleApprovalCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'telegram',
        externalId: '42',
        requestId: '11111111-1111-1111-1111-111111111111',
      }),
    )
    expect(notif.answerTelegramCallback).toHaveBeenCalledWith({
      callbackQueryId: 'cb-1',
      text: 'تأیید شد',
    })
    expect(notif.editTelegramMessageText).toHaveBeenCalledWith({
      chatId: '42',
      messageId: 99,
      text: '✅ تأیید شد',
      buttons: null,
    })
  })

  it('routes reject callback to handleRejectionCallback', async () => {
    vi.mocked(notif.getTelegramConfig).mockReturnValue({
      botToken: 'token',
      botUsername: 'TestBot',
      webhookSecret: 'real-secret',
    })
    vi.mocked(
      notif.messagingCommands.handleRejectionCallback,
    ).mockResolvedValue({
      messageHtml: '❌ رد شد',
      replacementKeyboard: null,
      toast: 'رد شد',
    } as never)

    const res = await app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'real-secret',
      },
      body: JSON.stringify({
        update_id: 3,
        callback_query: {
          id: 'cb-2',
          from: { id: 42 },
          message: { message_id: 100, chat: { id: 42 } },
          data: 'reject:22222222-2222-2222-2222-222222222222',
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleRejectionCallback).toHaveBeenCalled()
    expect(
      notif.messagingCommands.handleApprovalCallback,
    ).not.toHaveBeenCalled()
  })

  it('ignores unknown callback data with a silent ack', async () => {
    vi.mocked(notif.getTelegramConfig).mockReturnValue({
      botToken: 'token',
      botUsername: 'TestBot',
      webhookSecret: 'real-secret',
    })

    const res = await app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'real-secret',
      },
      body: JSON.stringify({
        update_id: 4,
        callback_query: {
          id: 'cb-3',
          from: { id: 42 },
          message: { message_id: 101, chat: { id: 42 } },
          data: 'gibberish',
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(
      notif.messagingCommands.handleApprovalCallback,
    ).not.toHaveBeenCalled()
    expect(
      notif.messagingCommands.handleRejectionCallback,
    ).not.toHaveBeenCalled()
    expect(notif.answerTelegramCallback).toHaveBeenCalledWith({
      callbackQueryId: 'cb-3',
    })
    expect(notif.editTelegramMessageText).not.toHaveBeenCalled()
  })

  async function postMessage(text: string) {
    vi.mocked(notif.getTelegramConfig).mockReturnValue({
      botToken: 'token',
      botUsername: 'TestBot',
      webhookSecret: 'real-secret',
    })
    return app.request('/api/v1/messaging/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'real-secret',
      },
      body: JSON.stringify({
        update_id: 99,
        message: {
          message_id: 1,
          from: { id: 42, first_name: 'Mo' },
          chat: { id: 42, type: 'private' },
          text,
        },
      }),
    })
  }

  it('routes /pending text to handlePendingCommand', async () => {
    vi.mocked(notif.messagingCommands.handlePendingCommand).mockResolvedValue({
      messages: [{ messageHtml: '✅ ندارد' }],
    } as never)
    const res = await postMessage('/pending')
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handlePendingCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'telegram',
        externalId: '42',
      }),
    )
    expect(notif.sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '42', text: '✅ ندارد' }),
    )
  })

  it('routes reply-keyboard "📋 درخواست‌های در انتظار" to handlePendingCommand', async () => {
    vi.mocked(notif.messagingCommands.handlePendingCommand).mockResolvedValue({
      messages: [{ messageHtml: '✅ ندارد' }],
    } as never)
    const res = await postMessage('📋 درخواست‌های در انتظار')
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handlePendingCommand).toHaveBeenCalled()
  })

  it('routes /today text to handleTodayCommand', async () => {
    vi.mocked(notif.messagingCommands.handleTodayCommand).mockResolvedValue({
      messages: [{ messageHtml: '📅 امروز' }],
    } as never)
    const res = await postMessage('/today')
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleTodayCommand).toHaveBeenCalled()
  })

  it('routes /unlink to handleUnlink', async () => {
    vi.mocked(notif.messagingCommands.handleUnlink).mockResolvedValue({
      status: 'ok',
      message: 'قطع شد',
    } as never)
    const res = await postMessage('/unlink')
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleUnlink).toHaveBeenCalledWith({
      provider: 'telegram',
      externalId: '42',
    })
    expect(notif.sendTelegramMessage).toHaveBeenCalledWith({
      chatId: '42',
      text: 'قطع شد',
    })
  })

  it('routes /help to handleHelpCommand', async () => {
    vi.mocked(notif.messagingCommands.handleHelpCommand).mockReturnValue({
      messages: [{ messageHtml: 'راهنما' }],
    } as never)
    const res = await postMessage('/help')
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleHelpCommand).toHaveBeenCalled()
  })
})

describe('messaging bale webhook', () => {
  const baleConfig = {
    botToken: 'token',
    botUsername: 'TestBaleBot',
    webhookSecret: 'real-secret',
  }

  it('200 no-op when bale is not configured', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(null)
    const res = await app.request('/api/v1/messaging/bale/webhook/any', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleLinkStart).not.toHaveBeenCalled()
  })

  it('200 no-op when path secret does not match', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)
    const res = await app.request('/api/v1/messaging/bale/webhook/wrong', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    })
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleLinkStart).not.toHaveBeenCalled()
  })

  it('invalid JSON returns 200 after secret verification', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)
    const res = await app.request(
      '/api/v1/messaging/bale/webhook/real-secret',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      },
    )
    expect(res.status).toBe(200)
  })

  it('routes /start <token> to handleLinkStart with provider bale', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)
    vi.mocked(notif.messagingCommands.handleLinkStart).mockResolvedValue({
      status: 'ok',
      message: 'متصل شد',
    } as never)
    vi.mocked(notif.sendBaleMessage).mockResolvedValue({
      status: 'sent',
    } as never)

    const res = await app.request(
      '/api/v1/messaging/bale/webhook/real-secret',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 1,
          message: {
            message_id: 99,
            from: { id: 42, username: 'mo', first_name: 'Mo' },
            chat: { id: 42, type: 'private' },
            text: '/start abc-123',
          },
        }),
      },
    )
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleLinkStart).toHaveBeenCalledWith({
      provider: 'bale',
      token: 'abc-123',
      externalId: '42',
      displayName: '@mo',
    })
    expect(notif.sendBaleMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '42',
        text: 'متصل شد',
        replyMarkup: expect.objectContaining({ is_persistent: true }),
      }),
    )
  })

  it('routes /pending text to handlePendingCommand and sends sanitized Bale text', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)
    vi.mocked(notif.messagingCommands.handlePendingCommand).mockResolvedValue({
      messages: [{ messageHtml: '<b>✅ ندارد</b>' }],
    } as never)
    const res = await app.request(
      '/api/v1/messaging/bale/webhook/real-secret',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 2,
          message: {
            message_id: 1,
            from: { id: 42, first_name: 'Mo' },
            chat: { id: 42, type: 'private' },
            text: '/pending',
          },
        }),
      },
    )
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handlePendingCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'bale',
        externalId: '42',
      }),
    )
    expect(notif.renderBaleBotHtml).toHaveBeenCalledWith('<b>✅ ندارد</b>')
    expect(notif.sendBaleMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '42', text: '✅ ندارد' }),
    )
  })

  it('routes approve callback to handleApprovalCallback and edits the Bale message', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)
    vi.mocked(notif.messagingCommands.handleApprovalCallback).mockResolvedValue(
      {
        messageHtml: '<b>✅ تأیید شد</b>',
        replacementKeyboard: null,
        toast: 'تأیید شد',
      } as never,
    )

    const res = await app.request(
      '/api/v1/messaging/bale/webhook/real-secret',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 3,
          callback_query: {
            id: 'cb-1',
            from: { id: 42, username: 'mo', first_name: 'Mo' },
            message: { message_id: 99, chat: { id: 42, type: 'private' } },
            data: 'approve:11111111-1111-1111-1111-111111111111',
          },
        }),
      },
    )
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleApprovalCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'bale',
        externalId: '42',
        requestId: '11111111-1111-1111-1111-111111111111',
      }),
    )
    expect(notif.answerBaleCallback).toHaveBeenCalledWith({
      callbackQueryId: 'cb-1',
      text: 'تأیید شد',
    })
    expect(notif.editBaleMessageText).toHaveBeenCalledWith({
      chatId: '42',
      messageId: 99,
      text: '✅ تأیید شد',
      buttons: null,
    })
  })

  it('routes staff-picker callbacks to handleAssignCallback', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)
    vi.mocked(notif.messagingCommands.handleAssignCallback).mockResolvedValue({
      messageHtml: '✅ تأیید شد',
      replacementKeyboard: null,
      toast: 'تأیید شد',
    } as never)

    const res = await app.request(
      '/api/v1/messaging/bale/webhook/real-secret',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 4,
          callback_query: {
            id: 'cb-2',
            from: { id: 42 },
            message: { message_id: 100, chat: { id: 42 } },
            data: 'asg:22222222-2222-2222-2222-222222222222:3',
          },
        }),
      },
    )
    expect(res.status).toBe(200)
    expect(notif.messagingCommands.handleAssignCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'bale',
        requestId: '22222222-2222-2222-2222-222222222222',
        staffIndex: 3,
      }),
    )
  })

  it('ignores unknown Bale callback data with a silent ack', async () => {
    vi.mocked(notif.getBaleConfig).mockReturnValue(baleConfig)

    const res = await app.request(
      '/api/v1/messaging/bale/webhook/real-secret',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 5,
          callback_query: {
            id: 'cb-3',
            from: { id: 42 },
            message: { message_id: 101, chat: { id: 42 } },
            data: 'gibberish',
          },
        }),
      },
    )
    expect(res.status).toBe(200)
    expect(
      notif.messagingCommands.handleApprovalCallback,
    ).not.toHaveBeenCalled()
    expect(
      notif.messagingCommands.handleRejectionCallback,
    ).not.toHaveBeenCalled()
    expect(notif.answerBaleCallback).toHaveBeenCalledWith({
      callbackQueryId: 'cb-3',
    })
    expect(notif.editBaleMessageText).not.toHaveBeenCalled()
  })
})
