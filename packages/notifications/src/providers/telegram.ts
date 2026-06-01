import { Api } from 'grammy'
import type {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  ReplyKeyboardRemove,
} from 'grammy/types'

import type {
  MessagingButton,
  MessagingDeliveryResult,
  MessagingProvider,
  MessagingSendInput,
} from './types'

export type TelegramConfig = {
  botToken: string
  botUsername: string
  webhookSecret: string
}

let resolveConfig: () => TelegramConfig | null = () => null
let cachedApi: { token: string; api: Api } | null = null

export function initTelegramMessaging(getConfig: () => TelegramConfig | null): void {
  resolveConfig = getConfig
  cachedApi = null
}

function getTelegramConfig(): TelegramConfig | null {
  return resolveConfig()
}

function getApi(config: TelegramConfig): Api {
  if (cachedApi && cachedApi.token === config.botToken) return cachedApi.api
  // Route through global fetch so tests can mock it and Node's modern fetch is preferred.
  const api = new Api(config.botToken, {
    fetch: ((url, init) => globalThis.fetch(url as RequestInfo, init)) as typeof fetch,
  })
  cachedApi = { token: config.botToken, api }
  return api
}

function toInlineKeyboard(
  rows: MessagingButton[][] | undefined
): InlineKeyboardMarkup | undefined {
  if (!rows || rows.length === 0) return undefined
  return {
    inline_keyboard: rows.map((row) =>
      row.map((b): InlineKeyboardButton =>
        b.url
          ? { text: b.label, url: b.url }
          : { text: b.label, callback_data: b.data ?? '' }
      )
    ),
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & { description?: string; payload?: unknown }
    if (anyErr.description) return anyErr.description
    return err.message
  }
  return 'telegram_send_error'
}

export async function sendTelegramMessage(input: {
  chatId: string
  text: string
  buttons?: MessagingButton[][]
  replyMarkup?: ReplyKeyboardMarkup | ReplyKeyboardRemove
}): Promise<MessagingDeliveryResult> {
  const config = getTelegramConfig()
  if (!config) {
    return { status: 'skipped', error: 'telegram_not_configured' }
  }
  const api = getApi(config)
  const inline = toInlineKeyboard(input.buttons)
  const reply_markup = inline ?? input.replyMarkup
  try {
    const message = await api.sendMessage(input.chatId, input.text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(reply_markup ? { reply_markup } : {}),
    })
    return { status: 'sent', providerMessageId: String(message.message_id) }
  } catch (err) {
    const error = describeError(err).slice(0, 1024)
    console.error('[messaging.send.failed]', { provider: 'telegram', error })
    return { status: 'failed', error }
  }
}

export async function editTelegramMessageText(input: {
  chatId: string
  messageId: number
  text: string
  buttons?: MessagingButton[][] | null
}): Promise<void> {
  const config = getTelegramConfig()
  if (!config) return
  const api = getApi(config)
  const reply_markup =
    input.buttons && input.buttons.length > 0
      ? toInlineKeyboard(input.buttons)
      : input.buttons === null
        ? { inline_keyboard: [] as InlineKeyboardButton[][] }
        : undefined
  try {
    await api.editMessageText(input.chatId, input.messageId, input.text, {
      parse_mode: 'HTML',
      ...(reply_markup ? { reply_markup } : {}),
    })
  } catch (err) {
    console.error('[messaging.edit.failed]', {
      provider: 'telegram',
      error: describeError(err).slice(0, 1024),
    })
  }
}

export async function answerTelegramCallback(input: {
  callbackQueryId: string
  text?: string
}): Promise<void> {
  const config = getTelegramConfig()
  if (!config) return
  const api = getApi(config)
  try {
    await api.answerCallbackQuery(input.callbackQueryId, input.text ? { text: input.text } : {})
  } catch {
    // best-effort
  }
}

export function createTelegramProvider(
  getConfig: () => TelegramConfig | null = resolveConfig
): MessagingProvider {
  return {
    id: 'telegram',
    displayName: 'Telegram',
    supportsInlineButtons: true,
    supportsInbound: true,
    isConfigured(): boolean {
      return getConfig() !== null
    },
    buildAccountLinkUrl(token: string): string | null {
      const config = getConfig()
      const username = config?.botUsername?.trim()
      if (!username) return null
      return `https://t.me/${username}?start=${token}`
    },
    async send(input: MessagingSendInput): Promise<MessagingDeliveryResult> {
      const config = getConfig()
      if (!config) {
        return { status: 'skipped', error: 'telegram_not_configured' }
      }
      const text = input.title
        ? `<b>${escapeHtml(input.title)}</b>\n${escapeHtml(input.body)}`
        : escapeHtml(input.body)
      const api = getApi(config)
      const inline = toInlineKeyboard(input.buttons)
      try {
        const message = await api.sendMessage(input.externalId, text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          ...(inline ? { reply_markup: inline } : {}),
        })
        return { status: 'sent', providerMessageId: String(message.message_id) }
      } catch (err) {
        const error = describeError(err).slice(0, 1024)
        console.error('[messaging.send.failed]', { provider: 'telegram', error })
        return { status: 'failed', error }
      }
    },
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export { getTelegramConfig }
