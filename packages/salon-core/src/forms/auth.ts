/**
 * Authentication form schemas shared by Saluna clients.
 * Both validates and normalizes (phone is canonical in the output payload).
 */
import { z } from 'zod'

import { formMessages } from './messages'
import { phoneSchema, requiredTextSchema } from './primitives'
import { slugSchema } from './slug'

const MIN_PASSWORD_LENGTH = 8

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

export const preWorkspaceAccountSchema = z.object({
  managerName: requiredTextSchema,
  password: z
    .string({ error: formMessages.required })
    .min(MIN_PASSWORD_LENGTH, formMessages.passwordTooShort),
})

export type PreWorkspaceAccountInput = z.input<typeof preWorkspaceAccountSchema>
export type PreWorkspaceAccountPayload = z.output<
  typeof preWorkspaceAccountSchema
>

export const preWorkspaceSchema = z.object({
  salonName: requiredTextSchema,
  slug: slugSchema.optional(),
})

export type PreWorkspaceInput = z.input<typeof preWorkspaceSchema>
export type PreWorkspacePayload = z.output<typeof preWorkspaceSchema>
