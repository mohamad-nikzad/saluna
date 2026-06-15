import { sendSmsOtp } from '@repo/notifications'
import {
  IRANIAN_MOBILE_PHONE_RE,
  canonicalSalonPhone,
} from '@repo/salon-core/phone'

export const AUTH_OTP_LENGTH = 6
export const AUTH_OTP_EXPIRES_IN_SECONDS = 300
export const AUTH_OTP_ALLOWED_ATTEMPTS = 3
export const AUTH_OTP_SEND_WINDOW_SECONDS = 60
export const AUTH_OTP_SEND_MAX_PER_WINDOW = 1
export const DEFAULT_AUTH_OTP_BYPASS_CODE = '123456'
const TEMP_EMAIL_DOMAIN = 'saluna.local'

export type AuthOtpEnv = {
  AUTH_OTP_BYPASS_ENABLED?: string | boolean | null
  AUTH_OTP_BYPASS_CODE?: string | null
}

export type AuthOtpConfig = {
  bypassEnabled: boolean
  bypassCode: string
}

function envFlagEnabled(value: string | boolean | null | undefined): boolean {
  return value === true || value === 'true' || value === '1'
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function readAuthOtpConfig(
  env: AuthOtpEnv = process.env,
): AuthOtpConfig {
  return {
    bypassEnabled: envFlagEnabled(env.AUTH_OTP_BYPASS_ENABLED),
    bypassCode: clean(env.AUTH_OTP_BYPASS_CODE) ?? DEFAULT_AUTH_OTP_BYPASS_CODE,
  }
}

export function normalizeAuthPhoneNumber(phoneNumber: string): string {
  return canonicalSalonPhone(phoneNumber)
}

export function isValidAuthPhoneNumber(phoneNumber: string): boolean {
  return IRANIAN_MOBILE_PHONE_RE.test(normalizeAuthPhoneNumber(phoneNumber))
}

export function getTempEmailForPhoneNumber(phoneNumber: string): string {
  return `${normalizeAuthPhoneNumber(phoneNumber)}@${TEMP_EMAIL_DOMAIN}`
}

export function getTempNameForPhoneNumber(phoneNumber: string): string {
  return normalizeAuthPhoneNumber(phoneNumber)
}

export async function sendAuthPhoneOtp(data: {
  phoneNumber: string
  code: string
}): Promise<void> {
  const config = readAuthOtpConfig()
  if (config.bypassEnabled) return

  const result = await sendSmsOtp({
    phone: normalizeAuthPhoneNumber(data.phoneNumber),
    code: data.code,
    purpose: 'signup',
    requestId: `auth-otp:${normalizeAuthPhoneNumber(data.phoneNumber)}`,
  })

  if (result.status !== 'sent') {
    throw new Error(result.error ?? 'auth_otp_send_failed')
  }
}

export function verifyBypassAuthPhoneOtp(data: { code: string }): boolean {
  const config = readAuthOtpConfig()
  return config.bypassEnabled && data.code === config.bypassCode
}
