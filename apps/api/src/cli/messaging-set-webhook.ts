import { Api } from 'grammy'
import type { BotCommand } from 'grammy/types'

import { getEnv, isValidTelegramWebhookSecret, readTelegramConfigFromEnv } from '../env'

/**
 * Registers the Telegram bot webhook URL, the discoverable `/` command list,
 * and the per-bot default Web App menu button.
 *
 * Reads `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL`,
 * and optional `MESSAGING_PWA_BASE_URL` / `PUBLIC_APP_BASE_URL`. Run on every
 * deploy where any of those change.
 *
 *   pnpm --filter @repo/api cli:messaging-set-webhook
 */

const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'اتصال یا راهنما' },
  { command: 'pending', description: 'درخواست‌های در انتظار' },
  { command: 'today', description: 'قرارهای امروز' },
  { command: 'unlink', description: 'قطع اتصال' },
  { command: 'help', description: 'راهنما' },
]

async function main() {
  const env = getEnv()
  const config = readTelegramConfigFromEnv(env)
  const url = env.TELEGRAM_WEBHOOK_URL?.trim()
  if (!config || !url) {
    console.error(
      '[messaging-set-webhook] missing TELEGRAM_ENABLED config or TELEGRAM_WEBHOOK_URL'
    )
    process.exit(2)
  }
  const secret = config.webhookSecret
  if (!isValidTelegramWebhookSecret(secret)) {
    console.error(
      '[messaging-set-webhook] TELEGRAM_WEBHOOK_SECRET must be 1–256 chars using only A–Z, a–z, 0–9, underscore, or hyphen'
    )
    process.exit(2)
  }

  const api = new Api(config.botToken)

  try {
    await api.setWebhook(url, {
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    })
    console.log('[messaging-set-webhook] setWebhook ok')
  } catch (err) {
    console.error('[messaging-set-webhook] setWebhook failed:', describeError(err))
    process.exit(1)
  }

  try {
    await api.setMyCommands(BOT_COMMANDS, { language_code: 'fa' })
    await api.setMyCommands(BOT_COMMANDS)
    console.log('[messaging-set-webhook] setMyCommands ok (fa + default)')
  } catch (err) {
    console.error('[messaging-set-webhook] setMyCommands failed:', describeError(err))
    process.exit(1)
  }

  const webAppUrl = (env.MESSAGING_PWA_BASE_URL ?? env.PUBLIC_APP_BASE_URL)?.trim()
  if (webAppUrl && !webAppUrl.startsWith('https://')) {
    console.warn(
      `[messaging-set-webhook] skipping menu button: Telegram requires HTTPS, got "${webAppUrl}". Set MESSAGING_PWA_BASE_URL to an HTTPS URL (e.g. tunnel your PWA) to enable.`
    )
  } else if (webAppUrl) {
    try {
      await api.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: 'باز کردن آراویرا',
          web_app: { url: webAppUrl },
        },
      })
      console.log(`[messaging-set-webhook] setChatMenuButton ok (${webAppUrl})`)
    } catch (err) {
      console.error('[messaging-set-webhook] setChatMenuButton failed:', describeError(err))
      process.exit(1)
    }
  } else {
    console.warn(
      '[messaging-set-webhook] MESSAGING_PWA_BASE_URL / PUBLIC_APP_BASE_URL not set; skipping menu button'
    )
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

main().catch((err) => {
  console.error('[messaging-set-webhook] error:', describeError(err))
  process.exit(1)
})
