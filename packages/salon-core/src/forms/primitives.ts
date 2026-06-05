/**
 * Platform-agnostic zod primitives for shared form schemas.
 * Pure zod + existing salon-core helpers. No React, no DOM/RN imports.
 */
import { z } from 'zod'
import { format, isValid, parseISO } from 'date-fns'

import { toLatinDigits } from '../persian-digits'
import { normalizePhone } from '../phone'
import { jalaliMonthLength, parseGregorianToJalali } from '../jalali'
import { formMessages } from './messages'

const MIN_PHONE_DIGITS = 10
const MAX_PHONE_DIGITS = 15

/**
 * Phone schema: accepts Persian/Arabic/Latin digits and assorted separators,
 * normalizes to digit-only Latin via `normalizePhone`, then validates length.
 * Input (z.input) is the raw string; output (z.output) is the canonical form.
 */
export const phoneSchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(1, formMessages.required)
  .transform((value) => normalizePhone(value))
  .pipe(
    z
      .string()
      .min(MIN_PHONE_DIGITS, formMessages.phoneTooShort)
      .max(MAX_PHONE_DIGITS, formMessages.phoneInvalid)
      .regex(/^\d+$/, formMessages.phoneInvalid),
  )

/**
 * Optional phone — empty string / null / undefined become `null`.
 */
export const optionalPhoneSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return ''
    return value
  })
  .transform((value) => normalizePhone(value))
  .transform((value) => (value.length === 0 ? null : value))
  .pipe(
    z.union([
      z.null(),
      z.string().min(MIN_PHONE_DIGITS, formMessages.phoneTooShort),
    ]),
  )

/**
 * Jalali date schema — accepts:
 *  - { jy, jm, jd } object
 *  - "yyyy/mm/dd" or "yyyy-mm-dd" string (Persian or Latin digits)
 * Validates month/day ranges including Jalali leap-year-aware Esfand length.
 */
export type JalaliDateParts = { jy: number; jm: number; jd: number }

function parseJalaliInput(value: unknown): JalaliDateParts | null {
  if (
    value &&
    typeof value === 'object' &&
    'jy' in value &&
    'jm' in value &&
    'jd' in value
  ) {
    const { jy, jm, jd } = value as JalaliDateParts
    if (
      [jy, jm, jd].every((n) => typeof n === 'number' && Number.isFinite(n))
    ) {
      return { jy, jm, jd }
    }
    return null
  }
  if (typeof value === 'string') {
    const normalized = toLatinDigits(value).trim()
    const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
    if (!match) return null
    const [, y, m, d] = match
    return { jy: Number(y), jm: Number(m), jd: Number(d) }
  }
  return null
}

export const jalaliDateSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    const parts = parseJalaliInput(value)
    if (!parts) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.jalaliDateInvalid,
      })
      return
    }
    const { jy, jm, jd } = parts
    if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.jalaliDateInvalid,
      })
      return
    }
    if (jd > jalaliMonthLength(jy, jm)) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.jalaliDateInvalid,
      })
    }
  })
  .transform((value) => parseJalaliInput(value) as JalaliDateParts)

/**
 * 6-digit hex color (with leading #). Persian digits are tolerated.
 */
export const hexColorSchema = z
  .string({ error: formMessages.required })
  .trim()
  .transform((value) => toLatinDigits(value))
  .pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, formMessages.hexColorInvalid))

/**
 * Duration in minutes. Accepts number or numeric string (Persian/Latin digits).
 */
export const durationMinutesSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const raw =
      typeof value === 'number' ? value : Number(toLatinDigits(value).trim())
    if (!Number.isFinite(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.numberInvalid,
      })
      return z.NEVER
    }
    return raw
  })
  .pipe(
    z
      .number()
      .int(formMessages.durationInvalid)
      .positive(formMessages.durationInvalid)
      .max(24 * 60, formMessages.durationTooLong),
  )

/**
 * Non-negative integer money amount. Accepts number or numeric string
 * (Persian/Latin digits) and normalizes to a number.
 */
export const nonNegativeMoneySchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === 'string' && toLatinDigits(value).trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.numberInvalid,
      })
      return z.NEVER
    }
    const raw =
      typeof value === 'number' ? value : Number(toLatinDigits(value).trim())
    if (!Number.isFinite(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.numberInvalid,
      })
      return z.NEVER
    }
    return raw
  })
  .pipe(
    z
      .number()
      .int(formMessages.priceInvalid)
      .min(0, formMessages.priceInvalid)
      .max(999_999_999, formMessages.priceTooHigh),
  )

/**
 * Non-negative integer. Accepts number or numeric string (Persian/Latin
 * digits) and rejects empty strings instead of coercing them to zero.
 */
export const nonNegativeIntegerSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === 'string' && toLatinDigits(value).trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.numberInvalid,
      })
      return z.NEVER
    }
    const raw =
      typeof value === 'number' ? value : Number(toLatinDigits(value).trim())
    if (!Number.isFinite(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.numberInvalid,
      })
      return z.NEVER
    }
    return raw
  })
  .pipe(
    z
      .number()
      .int(formMessages.numberInvalid)
      .min(0, formMessages.numberInvalid),
  )

/**
 * String of Persian/Arabic/Latin digits, normalized to Latin digits.
 * Empty-after-trim becomes a validation error.
 */
export const persianDigitsSchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(1, formMessages.required)
  .transform((value) => toLatinDigits(value))
  .pipe(z.string().regex(/^\d+$/, formMessages.numberInvalid))

/**
 * Required non-empty trimmed text.
 */
export const requiredTextSchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(1, formMessages.required)

/**
 * Optional trimmed text. Empty/nullish values become undefined.
 */
export const optionalTrimmedTextSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  })
  .optional()

/**
 * Gregorian "YYYY-MM-DD" used by the persisted appointment APIs.
 * The picker displays Jalali, but stores Gregorian strings.
 */
export const gregorianDateSchema = z
  .string({ error: formMessages.required })
  .trim()
  .transform((value) => toLatinDigits(value))
  .superRefine((value, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.dateInvalid,
      })
      return
    }
    const parsed = parseISO(value)
    if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== value) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.dateInvalid,
      })
      return
    }
    const { jy } = parseGregorianToJalali(value)
    if (jy < 1300 || jy > 1500) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.dateInvalid,
      })
    }
  })

/**
 * Time-of-day "HH:MM" (24h). Tolerates Persian/Arabic digits.
 */
export const timeOfDaySchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(1, formMessages.required)
  .transform((value) => toLatinDigits(value))
  .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, formMessages.timeInvalid))

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(':')
  return Number(h) * 60 + Number(m)
}
