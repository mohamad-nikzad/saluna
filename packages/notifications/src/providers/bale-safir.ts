import type { MessagingDeliveryResult } from './types'

export type BaleSafirConfig = {
  apiAccessKey: string
  botId: string
}

export type BaleSafirButton =
  | {
      label: string
      url: string
    }
  | {
      label: string
      webAppUrl: string
    }
  | {
      label: string
      copyText: string
    }

type BaleSafirFetchFn = typeof globalThis.fetch

type BaleSafirErrorInfo = {
  phone_number?: string
  code?: number
  description?: string
}

type BaleSafirSendMessageResponse = {
  message_id?: string
  error_data?: BaleSafirErrorInfo[] | BaleSafirErrorInfo | null
}

type BaleSafirInlineKeyboardButton =
  | { text: string; url: string }
  | { text: string; web_app: { url: string } }
  | { text: string; copy_text: string }

let resolveConfig: () => BaleSafirConfig | null = () => null
let fetchOverride: BaleSafirFetchFn | undefined

const SAFIR_SEND_MESSAGE_URL = 'https://safir.bale.ai/api/v3/send_message'

export function initBaleSafir(getConfig: () => BaleSafirConfig | null): void {
  resolveConfig = getConfig
}

/** @internal Vitest-only hook; production uses global fetch. */
export function setBaleSafirFetchForTests(
  fetchFn: BaleSafirFetchFn | undefined,
): void {
  fetchOverride = fetchFn
}

export function getBaleSafirConfig(): BaleSafirConfig | null {
  return resolveConfig()
}

function getFetch(): BaleSafirFetchFn {
  return fetchOverride ?? globalThis.fetch
}

function truncateError(error: string): string {
  return error.slice(0, 1024)
}

export function normalizeBaleSafirPhone(phone: string): string | null {
  const trimmed = phone.trim()
  const withoutInternationalPrefix = trimmed.startsWith('+')
    ? trimmed.slice(1)
    : trimmed
  const digits = withoutInternationalPrefix.replace(/\D/g, '')

  if (/^09\d{9}$/.test(digits)) return `98${digits.slice(1)}`
  if (/^9\d{9}$/.test(digits)) return `98${digits}`
  if (/^989\d{9}$/.test(digits)) return digits

  return null
}

export function mapBaleSafirErrorCode(code: number | undefined): string {
  switch (code) {
    case 8:
      return 'invalid_phone'
    case 17:
      return 'not_bale_user'
    case 3:
      return 'rate_limited'
    case 20:
      return 'payment_required'
    default:
      return 'safir_send_error'
  }
}

function getFirstSafirError(
  errorData: BaleSafirSendMessageResponse['error_data'],
): BaleSafirErrorInfo | null {
  if (!errorData) return null
  if (Array.isArray(errorData)) return errorData[0] ?? null
  return errorData
}

function isSafeHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function toSafirInlineKeyboard(
  rows: BaleSafirButton[][] | undefined,
):
  | {
      inline_keyboard: BaleSafirInlineKeyboardButton[][]
    }
  | undefined {
  if (!rows || rows.length === 0) return undefined

  const inline_keyboard = rows
    .map((row) =>
      row.flatMap((button): BaleSafirInlineKeyboardButton[] => {
        if ('url' in button) {
          if (!isSafeHttpsUrl(button.url)) return []
          return [{ text: button.label, url: button.url }]
        }
        if ('webAppUrl' in button) {
          if (!isSafeHttpsUrl(button.webAppUrl)) return []
          return [{ text: button.label, web_app: { url: button.webAppUrl } }]
        }
        if (!button.copyText) return []
        return [{ text: button.label, copy_text: button.copyText }]
      }),
    )
    .filter((row) => row.length > 0)

  if (inline_keyboard.length === 0) return undefined
  return { inline_keyboard }
}

export function buildBaleSafirSendMessageRequest(input: {
  config: BaleSafirConfig
  requestId: string
  phoneNumber: string
  text: string
  buttons?: BaleSafirButton[][]
}): {
  endpoint: string
  init: RequestInit
} {
  const replyMarkup = toSafirInlineKeyboard(input.buttons)
  return {
    endpoint: SAFIR_SEND_MESSAGE_URL,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-access-key': input.config.apiAccessKey,
      },
      body: JSON.stringify({
        request_id: input.requestId,
        bot_id: Number(input.config.botId),
        phone_number: input.phoneNumber,
        message_data: {
          message: {
            text: input.text,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          },
        },
      }),
    },
  }
}

export async function sendBaleSafirMessage(input: {
  phone: string
  text: string
  requestId: string
  buttons?: BaleSafirButton[][]
}): Promise<MessagingDeliveryResult & { phone?: string | null }> {
  const config = getBaleSafirConfig()
  if (!config) {
    return { status: 'skipped', error: 'safir_not_configured' }
  }

  const phoneNumber = normalizeBaleSafirPhone(input.phone)
  if (!phoneNumber) {
    return { status: 'failed', error: 'invalid_phone', phone: null }
  }

  const { endpoint, init } = buildBaleSafirSendMessageRequest({
    config,
    requestId: input.requestId,
    phoneNumber,
    text: input.text,
    buttons: input.buttons,
  })

  try {
    const response = await getFetch()(endpoint, init)
    const body = (await response.json().catch(() => null)) as
      | BaleSafirSendMessageResponse
      | null
    const safirError = getFirstSafirError(body?.error_data)

    if (!response.ok || safirError) {
      const error = safirError
        ? mapBaleSafirErrorCode(safirError.code)
        : `safir_http_${response.status}`
      console.error('[messaging.send.failed]', {
        provider: 'bale_safir',
        error,
      })
      return { status: 'failed', error, phone: phoneNumber }
    }

    return {
      status: 'sent',
      providerMessageId: body?.message_id ?? null,
      phone: phoneNumber,
    }
  } catch (err) {
    const error = truncateError(
      err instanceof Error ? err.message : 'safir_send_error',
    )
    console.error('[messaging.send.failed]', {
      provider: 'bale_safir',
      error,
    })
    return { status: 'failed', error, phone: phoneNumber }
  }
}
