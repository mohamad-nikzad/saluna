import type {
  MessagingButton,
  MessagingDeliveryResult,
  MessagingProvider,
  MessagingSendInput,
} from './types'

export type BaleConfig = {
  botToken: string
  botUsername: string
  webhookSecret: string
}

type BaleFetchFn = typeof globalThis.fetch

type BaleApiResponse<T> =
  | {
      ok: true
      result: T
      description?: string
    }
  | {
      ok: false
      description?: string
      error_code?: number
      parameters?: unknown
    }

type BaleInlineKeyboardMarkup = {
  inline_keyboard: BaleInlineKeyboardButton[][]
}

type BaleInlineKeyboardButton = {
  text: string
  callback_data?: string
  url?: string
}

type BaleMessageResult = {
  message_id?: number | string
}

let resolveConfig: () => BaleConfig | null = () => null
let fetchOverride: BaleFetchFn | undefined

export function initBaleMessaging(getConfig: () => BaleConfig | null): void {
  resolveConfig = getConfig
}

/** @internal Vitest-only hook; production uses global fetch. */
export function setBaleFetchForTests(fetchFn: BaleFetchFn | undefined): void {
  fetchOverride = fetchFn
}

export function getBaleConfig(): BaleConfig | null {
  return resolveConfig()
}

function getFetch(): BaleFetchFn {
  return fetchOverride ?? globalThis.fetch
}

function baleMethodUrl(config: BaleConfig, method: string): string {
  return `https://tapi.bale.ai/bot${config.botToken}/${method}`
}

function truncateErrorBody(body: string): string {
  return body.slice(0, 1024)
}

function describeBaleError(
  response: BaleApiResponse<unknown> | null,
  fallback: string,
): string {
  if (response && !response.ok) {
    const code = response.error_code
      ? `bale_${response.error_code}`
      : 'bale_api_error'
    return truncateErrorBody(
      response.description ? `${code}: ${response.description}` : code,
    )
  }
  return truncateErrorBody(fallback)
}

async function readBaleResponse<T>(
  response: Response,
): Promise<BaleApiResponse<T> | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as BaleApiResponse<T>
  } catch {
    return null
  }
}

function isValidBaleCallbackData(data: string): boolean {
  return new TextEncoder().encode(data).length <= 64
}

function isBaleInlineButtonUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

function toBaleInlineKeyboard(
  rows: MessagingButton[][] | undefined,
): BaleInlineKeyboardMarkup | undefined {
  if (!rows || rows.length === 0) return undefined
  const inline_keyboard = rows
    .map((row) =>
      row.flatMap((button): BaleInlineKeyboardButton[] => {
        if (button.url) {
          if (!isBaleInlineButtonUrl(button.url)) return []
          return [{ text: button.label, url: button.url }]
        }
        const data = button.data ?? ''
        if (!data || !isValidBaleCallbackData(data)) return []
        return [{ text: button.label, callback_data: data }]
      }),
    )
    .filter((row) => row.length > 0)
  if (inline_keyboard.length === 0) return undefined
  return { inline_keyboard }
}

async function callBaleMethod<T>(
  method: string,
  body: Record<string, unknown>,
  config: BaleConfig | null = getBaleConfig(),
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  if (!config) {
    return { ok: false, error: 'bale_not_configured' }
  }

  try {
    const response = await getFetch()(baleMethodUrl(config, method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const parsed = await readBaleResponse<T>(response)
    if (!response.ok || !parsed?.ok) {
      return {
        ok: false,
        error: describeBaleError(parsed, `bale_http_${response.status}`),
      }
    }
    return { ok: true, result: parsed.result }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'bale_send_error'
    return { ok: false, error: truncateErrorBody(error) }
  }
}

export function renderBaleMarkdown(input: {
  title?: string | null
  body: string
}): string {
  const body = escapeBaleMarkdown(input.body)
  if (!input.title) return body
  return `* ${escapeBaleMarkdown(input.title)} *\n${body}`
}

export async function sendBaleMessage(input: {
  chatId: string
  text: string
  buttons?: MessagingButton[][]
  replyMarkup?: Record<string, unknown>
}): Promise<MessagingDeliveryResult> {
  const config = getBaleConfig()
  if (!config) {
    return { status: 'skipped', error: 'bale_not_configured' }
  }
  const inline = toBaleInlineKeyboard(input.buttons)
  const reply_markup = inline ?? input.replyMarkup
  const result = await callBaleMethod<BaleMessageResult>('sendMessage', {
    chat_id: input.chatId,
    text: input.text,
    ...(reply_markup ? { reply_markup } : {}),
  })
  if (!result.ok) {
    console.error('[messaging.send.failed]', {
      provider: 'bale',
      error: result.error,
    })
    return { status: 'failed', error: result.error }
  }
  return {
    status: 'sent',
    providerMessageId:
      result.result.message_id === undefined
        ? null
        : String(result.result.message_id),
  }
}

export async function editBaleMessageText(input: {
  chatId: string
  messageId: number
  text: string
  buttons?: MessagingButton[][] | null
}): Promise<void> {
  const reply_markup =
    input.buttons && input.buttons.length > 0
      ? toBaleInlineKeyboard(input.buttons)
      : input.buttons === null
        ? { inline_keyboard: [] }
        : undefined
  const result = await callBaleMethod<true>('editMessageText', {
    chat_id: input.chatId,
    message_id: input.messageId,
    text: input.text,
    ...(reply_markup ? { reply_markup } : {}),
  })
  if (!result.ok && result.error !== 'bale_not_configured') {
    console.error('[messaging.edit.failed]', {
      provider: 'bale',
      error: result.error,
    })
  }
}

export async function editBaleMessageReplyMarkup(input: {
  chatId: string
  messageId: number
  buttons: MessagingButton[][] | null
}): Promise<void> {
  const reply_markup =
    input.buttons && input.buttons.length > 0
      ? toBaleInlineKeyboard(input.buttons)
      : { inline_keyboard: [] }
  const result = await callBaleMethod<true>('editMessageReplyMarkup', {
    chat_id: input.chatId,
    message_id: input.messageId,
    reply_markup,
  })
  if (!result.ok && result.error !== 'bale_not_configured') {
    console.error('[messaging.edit.failed]', {
      provider: 'bale',
      error: result.error,
    })
  }
}

export async function answerBaleCallback(input: {
  callbackQueryId: string
  text?: string
}): Promise<void> {
  await callBaleMethod<true>('answerCallbackQuery', {
    callback_query_id: input.callbackQueryId,
    ...(input.text ? { text: input.text } : {}),
  })
}

export function createBaleProvider(
  getConfig: () => BaleConfig | null = resolveConfig,
): MessagingProvider {
  return {
    id: 'bale',
    displayName: 'Bale',
    supportsInlineButtons: true,
    supportsInbound: true,
    isConfigured(): boolean {
      return getConfig() !== null
    },
    buildAccountLinkUrl(token: string): string | null {
      const username = getConfig()?.botUsername?.trim()
      if (!username) return null
      return `https://ble.ir/${username}?start=${token}`
    },
    async send(input: MessagingSendInput): Promise<MessagingDeliveryResult> {
      const config = getConfig()
      if (!config) {
        return { status: 'skipped', error: 'bale_not_configured' }
      }
      const replyMarkup = toBaleInlineKeyboard(input.buttons)
      const result = await callBaleMethod<BaleMessageResult>(
        'sendMessage',
        {
          chat_id: input.externalId,
          text: renderBaleMarkdown({ title: input.title, body: input.body }),
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        },
        config,
      )
      if (!result.ok) {
        console.error('[messaging.send.failed]', {
          provider: 'bale',
          error: result.error,
        })
        return { status: 'failed', error: result.error }
      }
      return {
        status: 'sent',
        providerMessageId:
          result.result.message_id === undefined
            ? null
            : String(result.result.message_id),
      }
    },
  }
}

export function escapeBaleMarkdown(s: string): string {
  return s.replace(/([\\*_`\[\]])/g, '\\$1')
}

export function renderBaleBotHtml(html: string): string {
  return escapeBaleMarkdown(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  )
}
