import { z } from 'zod'

import { formMessages } from './messages'

export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 40

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export const slugSchema = z
  .string({ error: formMessages.required })
  .trim()
  .min(SLUG_MIN_LENGTH, formMessages.slugTooShort)
  .max(SLUG_MAX_LENGTH, formMessages.slugTooLong)
  .regex(slugRegex, formMessages.slugInvalid)

export const slugUpdateSchema = z.object({ slug: slugSchema })

export type SlugUpdateInput = z.input<typeof slugUpdateSchema>
export type SlugUpdatePayload = z.output<typeof slugUpdateSchema>
