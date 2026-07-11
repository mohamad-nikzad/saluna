import { Api } from 'grammy'
import type { BotCommand } from 'grammy/types'
import { pathToFileURL } from 'node:url'

import {
  getEnv,
  type BaleConfig,
  type Env,
  isValidTelegramWebhookSecret,
  readBaleConfigFromEnv,
  readTelegramConfigFromEnv,
} from '../env'

/**
 * Registers messaging bot webhooks.
 *
 * Telegram also sets the discoverable `/` command list and per-bot default Web
 * App menu button. Bale only registers the webhook URL because Bale's docs for
 * setWebhook document the HTTPS URL parameter.
 *
 *   pnpm --filter @repo/api cli:messaging-set-webhook
 *   pnpm --filter @repo/api cli:messaging-set-webhook -- --provider=bale
 */

type Provider = 'telegram' | 'bale'

const BOT_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'اتصال یا راهنما' },
  { command: 'pending', description: 'درخواست‌های در انتظار' },
  { command: 'today', description: 'قرارهای امروز' },
  { command: 'unlink', description: 'قطع اتصال' },
  { command: 'help', description: 'راهنما' },
]

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const provider = parseProviderArg(argv)

  if (provider === 'bale') {
    return setBaleWebhookFromEnv(getEnv())
  }

  return setTelegramWebhookFromEnv(getEnv())
}

export function parseProviderArg(argv: string[]): Provider {
  let value: string | undefined
  let sawProviderArg = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg?.startsWith('--provider=')) {
      sawProviderArg = true
      value = arg.slice('--provider='.length)
      break
    }
    if (arg === '--provider') {
      sawProviderArg = true
      value = argv[index + 1]
      break
    }
  }

  if (sawProviderArg && !value) {
    throw new Error(
      'Missing provider value. Use --provider=telegram or --provider=bale.',
    )
  }
  if (!value) return 'telegram'
  if (value === 'telegram' || value === 'bale') return value
  throw new Error(
    `Unsupported provider "${value}". Use --provider=telegram or --provider=bale.`,
  )
}

async function setTelegramWebhookFromEnv(env: Env): Promise<number> {
  const config = readTelegramConfigFromEnv(env)
  const url = env.TELEGRAM_WEBHOOK_URL?.trim()
  if (!config || !url) {
    console.error(
      '[messaging-set-webhook] missing TELEGRAM_ENABLED config or TELEGRAM_WEBHOOK_URL',
    )
    return 2
  }
  const secret = config.webhookSecret
  if (!isValidTelegramWebhookSecret(secret)) {
    console.error(
      '[messaging-set-webhook] TELEGRAM_WEBHOOK_SECRET must be 1–256 chars using only A–Z, a–z, 0–9, underscore, or hyphen',
    )
    return 2
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
    console.error(
      '[messaging-set-webhook] setWebhook failed:',
      describeError(err),
    )
    return 1
  }

  try {
    await api.setMyCommands(BOT_COMMANDS, { language_code: 'fa' })
    await api.setMyCommands(BOT_COMMANDS)
    console.log('[messaging-set-webhook] setMyCommands ok (fa + default)')
  } catch (err) {
    console.error(
      '[messaging-set-webhook] setMyCommands failed:',
      describeError(err),
    )
    return 1
  }

  const webAppUrl = (
    env.MESSAGING_PWA_BASE_URL ?? env.PUBLIC_APP_BASE_URL
  )?.trim()
  if (webAppUrl && !webAppUrl.startsWith('https://')) {
    console.warn(
      `[messaging-set-webhook] skipping menu button: Telegram requires HTTPS, got "${webAppUrl}". Set MESSAGING_PWA_BASE_URL to an HTTPS URL (e.g. tunnel your PWA) to enable.`,
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
      console.error(
        '[messaging-set-webhook] setChatMenuButton failed:',
        describeError(err),
      )
      return 1
    }
  } else {
    console.warn(
      '[messaging-set-webhook] MESSAGING_PWA_BASE_URL / PUBLIC_APP_BASE_URL not set; skipping menu button',
    )
  }

  return 0
}

async function setBaleWebhookFromEnv(env: Env): Promise<number> {
  const resolved = resolveBaleWebhookInput(env)
  if (!resolved) {
    console.error(
      '[messaging-set-webhook] missing BALE_ENABLED config or BALE_WEBHOOK_URL',
    )
    return 2
  }

  try {
    assertBaleWebhookUrl(resolved.url, resolved.config.webhookSecret)
  } catch (err) {
    console.error(
      '[messaging-set-webhook] invalid BALE_WEBHOOK_URL:',
      describeError(err),
    )
    return 2
  }

  try {
    await setBaleWebhook(resolved)
    console.log('[messaging-set-webhook] Bale setWebhook ok')
    return 0
  } catch (err) {
    console.error(
      '[messaging-set-webhook] Bale setWebhook failed:',
      describeError(err),
    )
    return 1
  }
}

export function resolveBaleWebhookInput(
  env: Env,
): { config: BaleConfig; url: string } | null {
  const config = readBaleConfigFromEnv(env)
  const url = env.BALE_WEBHOOK_URL?.trim()
  if (!config || !url) return null
  return { config, url }
}

export function assertBaleWebhookUrl(url: string, secret: string): void {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new Error('Bale webhooks must use HTTPS')
  }
  if (parsed.port && parsed.port !== '443' && parsed.port !== '88') {
    throw new Error('Bale webhooks only support ports 443 and 88')
  }

  const hasSecretSegment = parsed.pathname
    .split('/')
    .filter(Boolean)
    .some((segment) => {
      try {
        return decodeURIComponent(segment) === secret
      } catch {
        return false
      }
    })

  if (!hasSecretSegment) {
    throw new Error(
      'BALE_WEBHOOK_URL must include BALE_WEBHOOK_SECRET as a path segment',
    )
  }
}

export function buildBaleSetWebhookRequest(input: {
  config: BaleConfig
  url: string
}): { endpoint: string; payload: { url: string } } {
  return {
    endpoint: `https://tapi.bale.ai/bot${input.config.botToken}/setWebhook`,
    payload: { url: input.url },
  }
}

export async function setBaleWebhook(
  input: { config: BaleConfig; url: string },
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const { endpoint, payload } = buildBaleSetWebhookRequest(input)
  const res = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    description?: string
    error_code?: number
  } | null

  if (!res.ok || body?.ok !== true) {
    const status = res.ok ? '' : `HTTP ${res.status}: `
    const description = body?.description ?? 'unknown Bale setWebhook error'
    const code = body?.error_code ? ` (error_code ${body.error_code})` : ''
    throw new Error(`${status}${description}${code}`)
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((err) => {
      console.error('[messaging-set-webhook] error:', describeError(err))
      process.exitCode = 1
    })
}
