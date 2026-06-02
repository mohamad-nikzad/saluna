/**
 * Authentication form schemas — shared between web (`apps/app`) and native (`apps/native`).
 * Both validates and normalizes (phone is canonical in the output payload).
 */
import { z } from 'zod'

import { formMessages } from './messages'
import { phoneSchema, requiredTextSchema } from './primitives'
import { slugSchema } from './slug'

const MIN_PASSWORD_LENGTH = 6

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z
    .string({ error: formMessages.required })
    .min(1, formMessages.required),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormPayload = z.output<typeof loginSchema>

export const signupSchema = z.object({
  salonName: requiredTextSchema,
  // Optional: Persian salon names can't form a Latin slug, so the web client
  // omits it and the server mints a unique placeholder. Clients that collect a
  // slug (native) may still send one.
  slug: slugSchema.optional(),
  managerName: requiredTextSchema,
  managerPhone: phoneSchema,
  password: z
    .string({ error: formMessages.required })
    .min(MIN_PASSWORD_LENGTH, formMessages.passwordTooShort),
})

export type SignupFormInput = z.input<typeof signupSchema>
export type SignupFormPayload = z.output<typeof signupSchema>
