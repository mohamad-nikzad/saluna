import { z } from 'zod'
import {
  buildSmsDeliveryConfigFromEnv,
  type SmsDeliveryConfig,
} from '@repo/notifications'

/** Telegram `secret_token` allowed charset (Bot API). */
export const TELEGRAM_WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/

export function isValidTelegramWebhookSecret(value: string): boolean {
  return TELEGRAM_WEBHOOK_SECRET_PATTERN.test(value)
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z
      .string()
      .default('3002')
      .transform((v) => Number.parseInt(v, 10))
      .pipe(z.number().int().positive()),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().optional(),
    CORS_ORIGINS: z
      .string()
      .default('*')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    MESSAGING_LINK_TOKEN_TTL_MINUTES: z
      .string()
      .default('15')
      .transform((v) => Number.parseInt(v, 10))
      .pipe(z.number().int().positive()),
    PUBLIC_APP_BASE_URL: z.string().url().optional(),
    TELEGRAM_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_BOT_USERNAME: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
    BALE_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    BALE_BOT_TOKEN: z.string().optional(),
    BALE_BOT_USERNAME: z.string().optional(),
    BALE_WEBHOOK_SECRET: z.string().optional(),
    BALE_WEBHOOK_URL: z.string().url().optional(),
    BALE_SAFIR_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    BALE_SAFIR_API_ACCESS_KEY: z.string().optional(),
    BALE_SAFIR_BOT_ID: z.string().optional(),
    SMS_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    SMS_PROVIDER: z.string().optional(),
    SMS_IR_API_KEY: z.string().optional(),
    SMS_IR_LINE_NUMBER: z.string().optional(),
    SMS_IR_OTP_TEMPLATE_ID: z.string().optional(),
    SMS_IR_OTP_PARAMETER_NAME: z.string().optional(),
    SMS_IR_API_BASE_URL: z.string().url().optional(),
    SMS_IR_LOGIN_TEMPLATE_ID: z.string().optional(),
    SMS_IR_SIGNUP_TEMPLATE_ID: z.string().optional(),
    SMS_IR_FORGOT_PASSWORD_TEMPLATE_ID: z.string().optional(),
    SMS_IR_APPOINTMENT_REQUEST_TEMPLATE_ID: z.string().optional(),
    MESSAGING_PWA_BASE_URL: z.string().url().optional(),
    AUTH_OTP_BYPASS_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),
    AUTH_OTP_BYPASS_CODE: z.string().default('123456'),
  })
  .superRefine((env, ctx) => {
    if (env.TELEGRAM_ENABLED) {
      for (const key of [
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_BOT_USERNAME',
        'TELEGRAM_WEBHOOK_SECRET',
      ] as const) {
        if (!env[key] || env[key]?.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when TELEGRAM_ENABLED=true`,
          })
        }
      }

      if (!env.PUBLIC_APP_BASE_URL || env.PUBLIC_APP_BASE_URL.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['PUBLIC_APP_BASE_URL'],
          message: 'PUBLIC_APP_BASE_URL is required when TELEGRAM_ENABLED=true',
        })
      }

      const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim()
      if (secret && !isValidTelegramWebhookSecret(secret)) {
        ctx.addIssue({
          code: 'custom',
          path: ['TELEGRAM_WEBHOOK_SECRET'],
          message:
            'TELEGRAM_WEBHOOK_SECRET must be 1–256 chars using only A–Z, a–z, 0–9, underscore, or hyphen (Telegram Bot API restriction)',
        })
      }
    }

    if (env.BALE_ENABLED) {
      for (const key of [
        'BALE_BOT_TOKEN',
        'BALE_BOT_USERNAME',
        'BALE_WEBHOOK_SECRET',
      ] as const) {
        if (!env[key] || env[key]?.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when BALE_ENABLED=true`,
          })
        }
      }
    }

    if (env.BALE_SAFIR_ENABLED) {
      for (const key of [
        'BALE_SAFIR_API_ACCESS_KEY',
        'BALE_SAFIR_BOT_ID',
      ] as const) {
        if (!env[key] || env[key]?.trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when BALE_SAFIR_ENABLED=true`,
          })
        }
      }
    }

    if (env.SMS_ENABLED) {
      if (env.SMS_PROVIDER?.trim() !== 'sms_ir') {
        ctx.addIssue({
          code: 'custom',
          path: ['SMS_PROVIDER'],
          message: 'SMS_PROVIDER must be sms_ir when SMS_ENABLED=true',
        })
      }

      if (!env.SMS_IR_API_KEY || env.SMS_IR_API_KEY.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['SMS_IR_API_KEY'],
          message: 'SMS_IR_API_KEY is required when SMS_ENABLED=true',
        })
      }
    }
  })

export type Env = z.infer<typeof envSchema>

export type TelegramConfig = {
  botToken: string
  botUsername: string
  webhookSecret: string
}

export type BaleConfig = {
  botToken: string
  botUsername: string
  webhookSecret: string
}

export type BaleSafirConfig = {
  apiAccessKey: string
  botId: string
}

/** Telegram bot credentials derived from validated env (null when disabled or incomplete). */
/** HTTPS PWA origin for Telegram deep links / Web App menu (tunnel URL in local dev). */
export function getMessagingAppBaseUrl(env: Env = getEnv()): string | null {
  const url = (env.MESSAGING_PWA_BASE_URL ?? env.PUBLIC_APP_BASE_URL)?.trim()
  return url || null
}

export function readTelegramConfigFromEnv(
  env: Env = getEnv(),
): TelegramConfig | null {
  if (!env.TELEGRAM_ENABLED) return null
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim()
  const botUsername = env.TELEGRAM_BOT_USERNAME?.trim()
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!botToken || !botUsername || !webhookSecret) return null
  return { botToken, botUsername, webhookSecret }
}

export function readBaleConfigFromEnv(env: Env = getEnv()): BaleConfig | null {
  if (!env.BALE_ENABLED) return null
  const botToken = env.BALE_BOT_TOKEN?.trim()
  const botUsername = env.BALE_BOT_USERNAME?.trim()
  const webhookSecret = env.BALE_WEBHOOK_SECRET?.trim()
  if (!botToken || !botUsername || !webhookSecret) return null
  return { botToken, botUsername, webhookSecret }
}

export function readBaleSafirConfigFromEnv(
  env: Env = getEnv(),
): BaleSafirConfig | null {
  if (!env.BALE_SAFIR_ENABLED) return null
  const apiAccessKey = env.BALE_SAFIR_API_ACCESS_KEY?.trim()
  const botId = env.BALE_SAFIR_BOT_ID?.trim()
  if (!apiAccessKey || !botId) return null
  return { apiAccessKey, botId }
}

export function readSmsDeliveryConfigFromEnv(
  env: Env = getEnv(),
): SmsDeliveryConfig | null {
  return buildSmsDeliveryConfigFromEnv(env)
}

let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid environment: ${messages}`)
  }
  cached = parsed.data
  return cached
}
