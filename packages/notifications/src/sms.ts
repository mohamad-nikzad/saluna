import { getUserById } from '@repo/database/auth-users'
import {
  getNotificationPreferences,
  type AppNotification,
  type NotificationDeliveryStatus,
} from '@repo/database/notifications'

export type SmsProviderId = 'sms_ir'

export type SmsPurpose =
  | 'login'
  | 'signup'
  | 'forgot_password'
  | 'appointment_request'
  | 'notification'
  | 'retention'

export type SmsDeliveryResult = {
  status: Extract<NotificationDeliveryStatus, 'sent' | 'failed' | 'skipped'>
  provider?: SmsProviderId | null
  providerMessageId?: string | null
  providerBatchId?: string | null
  providerMessageIds?: string[]
  error?: string | null
}

export type SmsOtpInput = {
  phone: string
  code: string
  purpose: SmsPurpose
  requestId?: string
  templateParams?: Record<string, string>
}

export type SmsTextInput = {
  phone: string
  message: string
  purpose?: SmsPurpose
  requestId?: string
}

export type SmsBulkInput = {
  recipients: string[]
  message: string
  purpose: SmsPurpose
  requestId?: string
}

export type SmsProvider = {
  readonly id: SmsProviderId
  readonly displayName: string
  isConfigured(): boolean
  sendOtp(input: SmsOtpInput): Promise<SmsDeliveryResult>
  sendText(input: SmsTextInput): Promise<SmsDeliveryResult>
  sendBulk(input: SmsBulkInput): Promise<SmsDeliveryResult>
}

export type SmsIrConfig = {
  apiKey: string
  lineNumber?: string | null
  otpTemplateId?: string | null
  apiBaseUrl?: string | null
  templates?: Partial<Record<SmsPurpose, string>>
}

export type SmsDeliveryConfig = {
  provider: SmsProviderId
  smsIr?: SmsIrConfig | null
}

export type SmsEnvVars = {
  SMS_ENABLED?: boolean | string | null
  SMS_PROVIDER?: string | null
  SMS_IR_API_KEY?: string | null
  SMS_IR_LINE_NUMBER?: string | null
  SMS_IR_OTP_TEMPLATE_ID?: string | null
  SMS_IR_API_BASE_URL?: string | null
  SMS_IR_LOGIN_TEMPLATE_ID?: string | null
  SMS_IR_SIGNUP_TEMPLATE_ID?: string | null
  SMS_IR_FORGOT_PASSWORD_TEMPLATE_ID?: string | null
  SMS_IR_APPOINTMENT_REQUEST_TEMPLATE_ID?: string | null
}

type SmsFetchFn = typeof globalThis.fetch

type SmsIrResponse = {
  status?: number
  message?: string
  data?: {
    messageId?: number | string | null
    messageIds?: Array<number | string | null>
    packId?: string | null
  } | null
}

const SMS_IR_DEFAULT_BASE_URL = 'https://api.sms.ir/v1'
const SMS_IR_BULK_LIMIT = 100
const SMS_IR_CODE_PARAMETER = 'Code'

let resolveConfig: () => SmsDeliveryConfig | null = () => null
let cachedProvider: { signature: string; provider: SmsProvider } | null = null
let fetchOverride: SmsFetchFn | undefined

export function initSmsDelivery(
  getConfig: () => SmsDeliveryConfig | null,
): void {
  resolveConfig = getConfig
  cachedProvider = null
}

/** @internal Vitest-only hook; production uses global fetch. */
export function setSmsFetchForTests(fetchFn: SmsFetchFn | undefined): void {
  fetchOverride = fetchFn
  cachedProvider = null
}

function getFetch(): SmsFetchFn {
  return fetchOverride ?? globalThis.fetch
}

function isSmsEnabled(value: boolean | string | null | undefined): boolean {
  return value === true || value === 'true' || value === '1'
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function buildSmsDeliveryConfigFromEnv(
  env: SmsEnvVars,
): SmsDeliveryConfig | null {
  if (!isSmsEnabled(env.SMS_ENABLED)) return null

  const provider = clean(env.SMS_PROVIDER)
  if (provider !== 'sms_ir') return null

  const apiKey = clean(env.SMS_IR_API_KEY)
  if (!apiKey) return null

  return {
    provider,
    smsIr: {
      apiKey,
      lineNumber: clean(env.SMS_IR_LINE_NUMBER),
      otpTemplateId: clean(env.SMS_IR_OTP_TEMPLATE_ID),
      apiBaseUrl: clean(env.SMS_IR_API_BASE_URL),
      templates: {
        login: clean(env.SMS_IR_LOGIN_TEMPLATE_ID) ?? undefined,
        signup: clean(env.SMS_IR_SIGNUP_TEMPLATE_ID) ?? undefined,
        forgot_password:
          clean(env.SMS_IR_FORGOT_PASSWORD_TEMPLATE_ID) ?? undefined,
        appointment_request:
          clean(env.SMS_IR_APPOINTMENT_REQUEST_TEMPLATE_ID) ?? undefined,
      },
    },
  }
}

function currentProviderId(): SmsProviderId | null {
  return resolveConfig()?.provider ?? null
}

function getConfiguredProvider(): SmsProvider | null {
  const config = resolveConfig()
  if (!config) return null
  if (config.provider !== 'sms_ir') return null
  const signature = JSON.stringify(config)
  if (cachedProvider?.signature === signature) return cachedProvider.provider
  const provider = createSmsIrProvider(() => config.smsIr ?? null)
  cachedProvider = { signature, provider }
  return provider
}

function sanitizeProviderMessage(_message: string | undefined): string {
  return 'sms_ir_rejected'
}

function logSmsFailure(input: {
  provider: SmsProviderId
  purpose?: SmsPurpose
  requestId?: string
  notificationId?: string
  error: string
}): void {
  console.error('[sms.send.failed]', {
    provider: input.provider,
    purpose: input.purpose,
    requestId: input.requestId,
    notificationId: input.notificationId,
    error: input.error,
  })
}

export function normalizeIranianMobile(phone: string): string | null {
  const digits = phone.trim().replace(/\D/g, '')
  const withoutInternationalPrefix = digits.startsWith('00')
    ? digits.slice(2)
    : digits

  if (/^09\d{9}$/.test(withoutInternationalPrefix)) {
    return withoutInternationalPrefix
  }
  if (/^9\d{9}$/.test(withoutInternationalPrefix)) {
    return `0${withoutInternationalPrefix}`
  }
  if (/^989\d{9}$/.test(withoutInternationalPrefix)) {
    return `0${withoutInternationalPrefix.slice(2)}`
  }

  return null
}

function smsIrBaseUrl(config: SmsIrConfig): string {
  return (config.apiBaseUrl?.trim() || SMS_IR_DEFAULT_BASE_URL).replace(
    /\/$/,
    '',
  )
}

function getSmsIrTemplateId(
  config: SmsIrConfig,
  purpose: SmsPurpose,
): string | null {
  return (
    config.templates?.[purpose]?.trim() || config.otpTemplateId?.trim() || null
  )
}

function parseSmsIrTemplateId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function isSmsIrConfigured(config: SmsIrConfig | null): config is SmsIrConfig {
  return Boolean(config?.apiKey?.trim())
}

function parseSmsIrMessageId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String(value)
  }
  return null
}

function parseSmsIrMessageIds(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    const id = parseSmsIrMessageId(value)
    return id ? [id] : []
  })
}

async function readSmsIrResponse(
  response: Response,
): Promise<SmsIrResponse | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as SmsIrResponse
  } catch {
    return null
  }
}

function smsIrHeaders(config: SmsIrConfig): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-API-KEY': config.apiKey,
  }
}

export function buildSmsIrVerifyRequest(input: {
  config: SmsIrConfig
  mobile: string
  code: string
  purpose: SmsPurpose
  templateParams?: Record<string, string>
}): { endpoint: string; init: RequestInit } | { error: string } {
  const templateId = getSmsIrTemplateId(input.config, input.purpose)
  if (!templateId) return { error: 'missing_template' }
  const numericTemplateId = parseSmsIrTemplateId(templateId)
  if (!numericTemplateId) return { error: 'invalid_template' }

  const parameters = [
    { name: SMS_IR_CODE_PARAMETER, value: input.code },
    ...Object.entries(input.templateParams ?? {})
      .filter(([name]) => name !== SMS_IR_CODE_PARAMETER)
      .map(([name, value]) => ({
        name,
        value,
      })),
  ]

  return {
    endpoint: `${smsIrBaseUrl(input.config)}/send/verify`,
    init: {
      method: 'POST',
      headers: smsIrHeaders(input.config),
      body: JSON.stringify({
        mobile: input.mobile,
        templateId: numericTemplateId,
        parameters,
      }),
    },
  }
}

function normalizeRecipients(recipients: string[]): string[] | null {
  const mobiles = recipients.map(normalizeIranianMobile)
  return mobiles.every((mobile): mobile is string => mobile !== null)
    ? mobiles
    : null
}

export function buildSmsIrBulkRequest(input: {
  config: SmsIrConfig
  mobiles: string[]
  message: string
}): { endpoint: string; init: RequestInit } | { error: string } {
  const lineNumber = input.config.lineNumber?.trim()
  if (!lineNumber) return { error: 'missing_line_number' }
  if (input.mobiles.length === 0) return { error: 'missing_recipients' }
  if (input.mobiles.length > SMS_IR_BULK_LIMIT)
    return { error: 'too_many_recipients' }

  return {
    endpoint: `${smsIrBaseUrl(input.config)}/send/bulk`,
    init: {
      method: 'POST',
      headers: smsIrHeaders(input.config),
      body: JSON.stringify({
        lineNumber,
        messageText: input.message,
        mobiles: input.mobiles,
      }),
    },
  }
}

function createSmsIrProvider(
  getConfig: () => SmsIrConfig | null = () => resolveConfig()?.smsIr ?? null,
): SmsProvider {
  async function callSmsIr(input: {
    endpoint: string
    init: RequestInit
    purpose?: SmsPurpose
    requestId?: string
  }): Promise<SmsDeliveryResult> {
    try {
      const response = await getFetch()(input.endpoint, input.init)
      const body = await readSmsIrResponse(response)

      if (!response.ok) {
        const error = `sms_ir_http_${response.status}`
        logSmsFailure({
          provider: 'sms_ir',
          purpose: input.purpose,
          requestId: input.requestId,
          error,
        })
        return { status: 'failed', provider: 'sms_ir', error }
      }

      if (body?.status !== 1) {
        const error = sanitizeProviderMessage(body?.message)
        logSmsFailure({
          provider: 'sms_ir',
          purpose: input.purpose,
          requestId: input.requestId,
          error,
        })
        return { status: 'failed', provider: 'sms_ir', error }
      }

      const providerMessageId = parseSmsIrMessageId(body.data?.messageId)
      const providerMessageIds = parseSmsIrMessageIds(body.data?.messageIds)
      return {
        status: 'sent',
        provider: 'sms_ir',
        providerMessageId,
        providerBatchId: body.data?.packId ?? null,
        ...(providerMessageIds.length > 0 ? { providerMessageIds } : {}),
      }
    } catch (err) {
      const error = 'sms_ir_send_error'
      logSmsFailure({
        provider: 'sms_ir',
        purpose: input.purpose,
        requestId: input.requestId,
        error,
      })
      return { status: 'failed', provider: 'sms_ir', error }
    }
  }

  return {
    id: 'sms_ir',
    displayName: 'sms.ir',
    isConfigured(): boolean {
      return isSmsIrConfigured(getConfig())
    },
    async sendOtp(input: SmsOtpInput): Promise<SmsDeliveryResult> {
      const config = getConfig()
      if (!isSmsIrConfigured(config)) {
        return {
          status: 'skipped',
          provider: 'sms_ir',
          error: 'provider_not_configured',
        }
      }

      const mobile = normalizeIranianMobile(input.phone)
      if (!mobile) {
        return { status: 'failed', provider: 'sms_ir', error: 'invalid_phone' }
      }

      const request = buildSmsIrVerifyRequest({
        config,
        mobile,
        code: input.code,
        purpose: input.purpose,
        templateParams: input.templateParams,
      })
      if ('error' in request) {
        return { status: 'skipped', provider: 'sms_ir', error: request.error }
      }

      return callSmsIr({
        endpoint: request.endpoint,
        init: request.init,
        purpose: input.purpose,
        requestId: input.requestId,
      })
    },
    async sendText(input: SmsTextInput): Promise<SmsDeliveryResult> {
      return this.sendBulk({
        recipients: [input.phone],
        message: input.message,
        purpose: input.purpose ?? 'notification',
        requestId: input.requestId,
      })
    },
    async sendBulk(input: SmsBulkInput): Promise<SmsDeliveryResult> {
      const config = getConfig()
      if (!isSmsIrConfigured(config)) {
        return {
          status: 'skipped',
          provider: 'sms_ir',
          error: 'provider_not_configured',
        }
      }

      const normalizedRecipients = normalizeRecipients(input.recipients)
      if (!normalizedRecipients) {
        return { status: 'failed', provider: 'sms_ir', error: 'invalid_phone' }
      }

      const request = buildSmsIrBulkRequest({
        config,
        mobiles: normalizedRecipients,
        message: input.message,
      })
      if ('error' in request) {
        return { status: 'skipped', provider: 'sms_ir', error: request.error }
      }

      const result = await callSmsIr({
        endpoint: request.endpoint,
        init: request.init,
        purpose: input.purpose,
        requestId: input.requestId,
      })
      const firstMessageId = result.providerMessageIds?.[0] ?? null
      return {
        ...result,
        providerMessageId: result.providerMessageId ?? firstMessageId,
      }
    },
  }
}

export function getSmsProvider(): SmsProvider | null {
  return getConfiguredProvider()
}

async function dispatchSms(
  send: (provider: SmsProvider) => Promise<SmsDeliveryResult>,
): Promise<SmsDeliveryResult> {
  const provider = getConfiguredProvider()
  if (!provider) {
    return {
      status: 'skipped',
      provider: currentProviderId(),
      error: 'provider_not_configured',
    }
  }
  return send(provider)
}

export async function sendSmsOtp(
  input: SmsOtpInput,
): Promise<SmsDeliveryResult> {
  return dispatchSms((provider) => provider.sendOtp(input))
}

export async function sendSmsText(
  input: SmsTextInput,
): Promise<SmsDeliveryResult> {
  return dispatchSms((provider) => provider.sendText(input))
}

export async function sendSmsBulk(
  input: SmsBulkInput,
): Promise<SmsDeliveryResult> {
  return dispatchSms((provider) => provider.sendBulk(input))
}

export async function sendSmsNotification(
  notification: AppNotification,
): Promise<SmsDeliveryResult> {
  const provider = getConfiguredProvider()
  if (!provider) {
    return {
      status: 'skipped',
      provider: currentProviderId(),
      error: 'provider_not_configured',
    }
  }

  const preferences = await getNotificationPreferences(
    notification.salonId,
    notification.userId,
  )
  if (!preferences.smsAlertsEnabled) {
    return {
      status: 'skipped',
      provider: provider.id,
      error: 'sms_alerts_disabled',
    }
  }

  const recipient = await getUserById(notification.userId)
  const phone = recipient?.phone.trim()
  if (!recipient || recipient.salonId !== notification.salonId || !phone) {
    return {
      status: 'skipped',
      provider: provider.id,
      error: 'sms_recipient_not_found',
    }
  }

  return provider.sendText({
    phone,
    message: `${notification.title}\n${notification.body}`,
    purpose: 'notification',
    requestId: `notification:${notification.id}:sms`,
  })
}
