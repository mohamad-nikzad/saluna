/**
 * Client form schema — shared between PWA (`apps/pwa`) and native (`apps/native`).
 * Both validates and normalizes (phone becomes canonical in the payload).
 */
import { z } from 'zod'

import { formMessages } from './messages'
import { phoneSchema, requiredTextSchema } from './primitives'

const MAX_TAGS = 8

const tagsSchema = z
  .array(z.string())
  .max(MAX_TAGS)
  .default([])
  .transform((labels) =>
    [...new Set(labels.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TAGS),
  )

const notesSchema = z
  .string()
  .optional()
  .transform((v) => {
    if (v == null) return undefined
    const trimmed = v.trim()
    return trimmed.length === 0 ? undefined : trimmed
  })

export const clientFormSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
  notes: notesSchema,
  tags: tagsSchema,
})

export const clientCreateSchema = clientFormSchema.extend({
  id: z.string().optional(),
})

export const clientUpdateSchema = z.object({
  name: requiredTextSchema.optional(),
  phone: phoneSchema.optional(),
  notes: notesSchema,
  tags: z
    .array(z.string())
    .max(MAX_TAGS)
    .optional()
    .transform((labels) =>
      labels == null
        ? undefined
        : [...new Set(labels.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TAGS),
    ),
})

export type ClientFormInput = z.input<typeof clientFormSchema>
export type ClientFormPayload = z.output<typeof clientFormSchema>
export type ClientCreateInput = z.input<typeof clientCreateSchema>
export type ClientCreatePayload = z.output<typeof clientCreateSchema>
export type ClientUpdateInput = z.input<typeof clientUpdateSchema>
export type ClientUpdatePayload = z.output<typeof clientUpdateSchema>

export { MAX_TAGS as MAX_CLIENT_TAGS }
export { formMessages }
