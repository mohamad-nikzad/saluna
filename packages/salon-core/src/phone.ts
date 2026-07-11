/** Normalize phone for storage and unique lookup (digits only, Persian/Arabic → Latin). */
import { toLatinDigits, toPersianDigits } from './persian-digits'

export function normalizePhone(input: string): string {
  const s = toLatinDigits(input.trim())
  return s.replace(/\D/g, '')
}

/** Iranian mobile in canonical salon form: `09` + 9 digits (11 total). */
export const IRANIAN_MOBILE_PHONE_RE = /^09\d{9}$/

/** Canonical salon phone: digits only, Iranian mobiles as `09XXXXXXXXX`. */
export function canonicalSalonPhone(input: string): string {
  const normalized = normalizePhone(input)
  if (/^989\d{9}$/.test(normalized)) return `0${normalized.slice(2)}`
  if (/^9\d{9}$/.test(normalized)) return `0${normalized}`
  return normalized
}

/** All stored-phone forms to match for lookup (canonical + legacy normalizePhone variants). */
export function phoneLookupVariants(input: string): string[] {
  const canonical = canonicalSalonPhone(input)
  const variants = new Set([canonical])
  if (/^09\d{9}$/.test(canonical)) {
    const rest = canonical.slice(2)
    variants.add(`98${rest.slice(1)}`)
    variants.add(`989${rest.slice(1)}`)
  }
  return [...variants]
}

export function hasPhone(
  normalized: string | null | undefined,
): normalized is string {
  return typeof normalized === 'string' && normalized.length > 0
}

export function displayPhone(
  normalized: string | null | undefined,
  fallback = '',
): string {
  return hasPhone(normalized) ? toPersianDigits(normalized) : fallback
}
