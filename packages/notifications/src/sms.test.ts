import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSmsDeliveryConfigFromEnv,
  buildSmsIrBulkRequest,
  buildSmsIrVerifyRequest,
  initSmsDelivery,
  normalizeIranianMobile,
  sendSmsBulk,
  sendSmsNotification,
  sendSmsOtp,
  setSmsFetchForTests,
  type SmsDeliveryConfig,
  type SmsIrConfig,
} from './sms'

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

const smsIrConfig: SmsIrConfig = {
  apiKey: 'secret-api-key',
  lineNumber: '30004505000017',
  otpTemplateId: '123456',
  apiBaseUrl: 'https://api.sms.ir/v1',
}

const deliveryConfig: SmsDeliveryConfig = {
  provider: 'sms_ir',
  smsIr: smsIrConfig,
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function fetchMock(response: Response): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(response)
}

describe('SMS delivery foundation', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    initSmsDelivery(() => null)
    setSmsFetchForTests(undefined)
    mocks.getUserById.mockReset()
    mocks.getNotificationPreferences.mockReset()
  })

  it('skips cleanly when no SMS provider is configured', async () => {
    vi.stubEnv('SMS_ENABLED', 'true')
    vi.stubEnv('SMS_PROVIDER', 'sms_ir')
    vi.stubEnv('SMS_IR_API_KEY', 'secret-api-key')

    await expect(sendSmsNotification(notification)).resolves.toEqual({
      status: 'skipped',
      provider: null,
      error: 'provider_not_configured',
    })
    expect(mocks.getNotificationPreferences).not.toHaveBeenCalled()
    expect(mocks.getUserById).not.toHaveBeenCalled()
  })

  it('builds SMS config from explicit env only', () => {
    expect(
      buildSmsDeliveryConfigFromEnv({
        SMS_ENABLED: true,
        SMS_PROVIDER: 'sms_ir',
        SMS_IR_API_KEY: ' secret-api-key ',
        SMS_IR_LINE_NUMBER: ' ',
        SMS_IR_OTP_TEMPLATE_ID: '123456',
        SMS_IR_OTP_PARAMETER_NAME: 'CODE',
        SMS_IR_LOGIN_TEMPLATE_ID: '654321',
      }),
    ).toEqual({
      provider: 'sms_ir',
      smsIr: {
        apiKey: 'secret-api-key',
        lineNumber: null,
        otpTemplateId: '123456',
        otpParameterName: 'CODE',
        apiBaseUrl: null,
        templates: {
          login: '654321',
          signup: undefined,
          forgot_password: undefined,
          appointment_request: undefined,
        },
      },
    })
  })

  it('normalizes Iranian mobile numbers for provider calls', () => {
    expect(normalizeIranianMobile('09123456789')).toBe('09123456789')
    expect(normalizeIranianMobile('9123456789')).toBe('09123456789')
    expect(normalizeIranianMobile('+98 912 345 6789')).toBe('09123456789')
    expect(normalizeIranianMobile('00989123456789')).toBe('09123456789')
    expect(normalizeIranianMobile('12345')).toBeNull()
  })

  it('builds sms.ir verify requests without exposing provider details to callers', async () => {
    const request = buildSmsIrVerifyRequest({
      config: smsIrConfig,
      mobile: '09123456789',
      code: '246810',
      purpose: 'login',
      templateParams: { Salon: 'Saluna' },
    })

    expect('error' in request).toBe(false)
    if ('error' in request) throw new Error(request.error)

    expect(request.endpoint).toBe('https://api.sms.ir/v1/send/verify')
    expect(request.init.method).toBe('POST')
    expect(request.init.headers).toMatchObject({
      'X-API-KEY': 'secret-api-key',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(request.init.body))).toEqual({
      mobile: '09123456789',
      templateId: 123456,
      parameters: [
        { name: 'Code', value: '246810' },
        { name: 'Salon', value: 'Saluna' },
      ],
    })
  })

  it('rejects non-numeric sms.ir template ids before sending', () => {
    const request = buildSmsIrVerifyRequest({
      config: { ...smsIrConfig, otpTemplateId: 'template-login' },
      mobile: '09123456789',
      code: '246810',
      purpose: 'login',
    })

    expect(request).toEqual({ error: 'invalid_template' })
  })

  it('keeps the OTP code parameter provider-owned', () => {
    const request = buildSmsIrVerifyRequest({
      config: smsIrConfig,
      mobile: '09123456789',
      code: '246810',
      purpose: 'login',
      templateParams: { Code: '000000', Salon: 'Saluna' },
    })

    expect('error' in request).toBe(false)
    if ('error' in request) throw new Error(request.error)

    expect(JSON.parse(String(request.init.body)).parameters).toEqual([
      { name: 'Code', value: '246810' },
      { name: 'Salon', value: 'Saluna' },
    ])
  })

  it('uses the configured sms.ir OTP parameter name when templates differ', () => {
    const request = buildSmsIrVerifyRequest({
      config: { ...smsIrConfig, otpParameterName: 'CODE' },
      mobile: '09123456789',
      code: '246810',
      purpose: 'login',
      templateParams: { Code: '000000', Salon: 'Saluna' },
    })

    expect('error' in request).toBe(false)
    if ('error' in request) throw new Error(request.error)

    expect(JSON.parse(String(request.init.body)).parameters).toEqual([
      { name: 'CODE', value: '246810' },
      { name: 'Code', value: '000000' },
      { name: 'Salon', value: 'Saluna' },
    ])
  })

  it('sends OTPs through sms.ir verify and parses message id', async () => {
    initSmsDelivery(() => deliveryConfig)
    const fetch = fetchMock(
      jsonResponse({
        status: 1,
        message: 'موفق',
        data: { messageId: 89545112 },
      }),
    )
    setSmsFetchForTests(fetch)

    await expect(
      sendSmsOtp({
        phone: '+989123456789',
        code: '246810',
        purpose: 'login',
        requestId: 'otp-1',
      }),
    ).resolves.toMatchObject({
      status: 'sent',
      provider: 'sms_ir',
      providerMessageId: '89545112',
    })

    const [, init] = fetch.mock.calls[0]
    expect(JSON.parse(String(init.body)).mobile).toBe('09123456789')
  })

  it('builds sms.ir bulk requests for future retention sends', () => {
    const request = buildSmsIrBulkRequest({
      config: smsIrConfig,
      mobiles: ['09123456789', '09129876543'],
      message: 'یادآوری مراجعه',
    })

    expect('error' in request).toBe(false)
    if ('error' in request) throw new Error(request.error)

    expect(request.endpoint).toBe('https://api.sms.ir/v1/send/bulk')
    expect(JSON.parse(String(request.init.body))).toEqual({
      lineNumber: '30004505000017',
      messageText: 'یادآوری مراجعه',
      mobiles: ['09123456789', '09129876543'],
    })
  })

  it('sends bulk SMS and parses pack id and message ids', async () => {
    initSmsDelivery(() => deliveryConfig)
    const fetch = fetchMock(
      jsonResponse({
        status: 1,
        message: 'موفق',
        data: {
          packId: 'pack-1',
          messageIds: [86522023, 86522024],
        },
      }),
    )
    setSmsFetchForTests(fetch)

    await expect(
      sendSmsBulk({
        recipients: ['09123456789', '+989129876543'],
        message: 'یادآوری مراجعه',
        purpose: 'retention',
        requestId: 'retention-1',
      }),
    ).resolves.toMatchObject({
      status: 'sent',
      provider: 'sms_ir',
      providerBatchId: 'pack-1',
      providerMessageId: '86522023',
      providerMessageIds: ['86522023', '86522024'],
    })
  })

  it('returns sanitized provider errors without API keys or OTP codes', async () => {
    initSmsDelivery(() => deliveryConfig)
    const fetch = fetchMock(
      jsonResponse({
        status: 0,
        message: 'invalid key secret-api-key code 246810',
        data: null,
      }),
    )
    setSmsFetchForTests(fetch)

    const result = await sendSmsOtp({
      phone: '09123456789',
      code: '246810',
      purpose: 'login',
      requestId: 'otp-2',
    })

    expect(result).toMatchObject({
      status: 'failed',
      provider: 'sms_ir',
      error: 'sms_ir_rejected',
    })
    expect(JSON.stringify(result)).not.toContain('secret-api-key')
    expect(JSON.stringify(result)).not.toContain('246810')
  })

  it('returns a fixed error code for thrown fetch failures', async () => {
    initSmsDelivery(() => deliveryConfig)
    const fetch = vi
      .fn()
      .mockRejectedValue(new Error('secret-api-key network exploded 246810'))
    setSmsFetchForTests(fetch)

    const result = await sendSmsOtp({
      phone: '09123456789',
      code: '246810',
      purpose: 'login',
      requestId: 'otp-network',
    })

    expect(result).toMatchObject({
      status: 'failed',
      provider: 'sms_ir',
      error: 'sms_ir_send_error',
    })
    expect(JSON.stringify(result)).not.toContain('secret-api-key')
    expect(JSON.stringify(result)).not.toContain('246810')
  })

  it('sends existing notifications through the typed text path', async () => {
    initSmsDelivery(() => deliveryConfig)
    mocks.getNotificationPreferences.mockResolvedValue({
      salonId: 'salon-a',
      userId: 'user-a',
      appointmentAlertsEnabled: true,
      localAlertsEnabled: true,
      smsAlertsEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mocks.getUserById.mockResolvedValue({
      id: 'user-a',
      salonId: 'salon-a',
      name: 'Staff',
      fullName: 'Staff',
      nickname: null,
      phone: '09123456789',
      role: 'staff',
      color: 'rose',
      createdAt: new Date(),
    })
    const fetch = fetchMock(
      jsonResponse({
        status: 1,
        message: 'موفق',
        data: { packId: 'pack-2', messageIds: [86522025] },
      }),
    )
    setSmsFetchForTests(fetch)

    await expect(sendSmsNotification(notification)).resolves.toMatchObject({
      status: 'sent',
      provider: 'sms_ir',
      providerBatchId: 'pack-2',
      providerMessageId: '86522025',
    })

    const [, init] = fetch.mock.calls[0]
    expect(JSON.parse(String(init.body))).toMatchObject({
      lineNumber: '30004505000017',
      messageText: 'نوبت جدید\nاعلان تست',
      mobiles: ['09123456789'],
    })
  })
})
