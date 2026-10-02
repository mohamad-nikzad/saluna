/**
 * Client form schema shared by Saluna clients.
 * Both validates and normalizes (phone becomes canonical in the payload).
 */
import { z } from 'zod'

import { MAX_BULK_CLIENTS } from './limits'
import { formMessages } from './messages'
import { phoneSchema, requiredTextSchema } from './primitives'
import { jalaliMonthLength, jalaliToGregorianStr } from '../jalali'
import { salonTodayYmd } from '../salon-local-time'
import { toLatinDigits, toPersianDigits } from '../persian-digits'
import { CLIENT_ACQUISITION_SOURCES } from '../types'

const MAX_TAGS = 8

const tagsSchema = z
  .array(z.string())
  .max(MAX_TAGS)
  .default([])
  .transform((labels) =>
    [...new Set(labels.map((t) => t.trim()).filter(Boolean))].slice(
      0,
      MAX_TAGS,
    ),
  )

const notesSchema = z
  .string()
  .optional()
  .transform((v) => {
    if (v == null) return undefined
    const trimmed = v.trim()
    return trimmed.length === 0 ? undefined : trimmed
  })

export function formatJalaliBirthDateInput(value: string): string {
  const normalized = toLatinDigits(value)
  const separators = normalized.match(/[/-]/g)?.length ?? 0

  if (separators >= 2) {
    const [year = '', month = '', day = ''] = normalized.split(/[/-]/)
    return toPersianDigits(
      [
        year.replace(/\D/g, '').slice(0, 4),
        month.replace(/\D/g, '').slice(0, 2),
        day.replace(/\D/g, '').slice(0, 2),
      ].join('/'),
    )
  }

  const digits = normalized.replace(/\D/g, '').slice(0, 8)
  return toPersianDigits(
    [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6)]
      .filter(Boolean)
      .join('/'),
  )
}

const birthDateSchema = z
  .string()
  .nullish()
  .transform((value, ctx) => {
    if (value === undefined) return undefined
    const normalized = toLatinDigits(value ?? '').trim()
    if (!normalized) return null
    const match = normalized.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,2})$/)
    if (!match) {
      ctx.addIssue({ code: 'custom', message: formMessages.jalaliDateInvalid })
      return z.NEVER
    }
    const [, year, month, day] = match.map(Number)
    if (
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > jalaliMonthLength(year, month)
    ) {
      ctx.addIssue({ code: 'custom', message: formMessages.jalaliDateInvalid })
      return z.NEVER
    }
    const gregorian = jalaliToGregorianStr(year, month, day)
    if (gregorian > salonTodayYmd()) {
      ctx.addIssue({
        code: 'custom',
        message: 'تاریخ تولد نمی‌تواند در آینده باشد',
      })
      return z.NEVER
    }
    return gregorian
  })

export const clientFormSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
  notes: notesSchema,
  birthDate: birthDateSchema,
  acquisitionSource: z.enum(CLIENT_ACQUISITION_SOURCES).optional(),
  tags: tagsSchema,
})

export const clientCreateSchema = clientFormSchema.extend({
  id: z.string().optional(),
})

export const clientBulkCreateItemSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
})

export const clientBulkCreateSchema = z.object({
  clients: z
    .array(clientBulkCreateItemSchema)
    .min(1, 'حداقل یک مشتری لازم است')
    .max(MAX_BULK_CLIENTS, `حداکثر ${MAX_BULK_CLIENTS} مشتری در هر درخواست`),
})

export const clientUpdateSchema = z.object({
  name: requiredTextSchema.optional(),
  phone: phoneSchema.optional(),
  notes: notesSchema,
  birthDate: birthDateSchema,
  acquisitionSource: z.enum(CLIENT_ACQUISITION_SOURCES).optional(),
  tags: z
    .array(z.string())
    .max(MAX_TAGS)
    .optional()
    .transform((labels) =>
      labels == null
        ? undefined
        : [...new Set(labels.map((t) => t.trim()).filter(Boolean))].slice(
            0,
            MAX_TAGS,
          ),
    ),
})

export type ClientFormInput = z.input<typeof clientFormSchema>
export type ClientFormPayload = z.output<typeof clientFormSchema>
export type ClientCreateInput = z.input<typeof clientCreateSchema>
export type ClientCreatePayload = z.output<typeof clientCreateSchema>
export type ClientUpdateInput = z.input<typeof clientUpdateSchema>
export type ClientUpdatePayload = z.output<typeof clientUpdateSchema>
export type ClientBulkCreateItemInput = z.input<
  typeof clientBulkCreateItemSchema
>
export type ClientBulkCreateItemPayload = z.output<
  typeof clientBulkCreateItemSchema
>
export type ClientBulkCreateInput = z.input<typeof clientBulkCreateSchema>
export type ClientBulkCreatePayload = z.output<typeof clientBulkCreateSchema>

export { MAX_TAGS as MAX_CLIENT_TAGS }
export { formMessages }
