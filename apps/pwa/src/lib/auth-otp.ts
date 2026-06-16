import { useEffect, useState } from 'react'
import { ApiError } from '@repo/api-client'
import { toLatinDigits } from '@repo/salon-core/persian-digits'

import { getMutationErrorMessage } from '#/lib/query-client'

export const AUTH_OTP_CODE_LENGTH = 6
export const AUTH_OTP_RESEND_SECONDS = 180

export function normalizeOtpCode(value: string): string {
  return toLatinDigits(value).replace(/\D/g, '')
}

export function getOtpErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const payload = err.payload
    const code =
      payload && typeof payload === 'object' && 'code' in payload
        ? (payload as { code: unknown }).code
        : null

    if (code === 'INVALID_OTP') return 'کد واردشده درست نیست'
    if (code === 'OTP_EXPIRED') return 'کد منقضی شده است. دوباره کد بگیرید.'
    if (code === 'TOO_MANY_ATTEMPTS') {
      return 'تعداد تلاش‌ها زیاد شد. دوباره کد بگیرید.'
    }
    if (code === 'OTP_NOT_FOUND') return 'ابتدا کد جدید دریافت کنید.'
    if (err.status === 429) return 'برای دریافت کد جدید کمی صبر کنید.'
  }

  return getMutationErrorMessage(err, 'کد تایید بررسی نشد. دوباره تلاش کنید.')
}

export function useResendCountdown(targetTime: number | null) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!targetTime) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [targetTime])

  return targetTime ? Math.max(0, Math.ceil((targetTime - now) / 1000)) : 0
}
