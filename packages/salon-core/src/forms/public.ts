/**
 * Public (unauthenticated) booking form schemas.
 *
 * `publicAppointmentRequestSchema` validates a customer-submitted appointment
 * request: strict Iranian phone format (`09XXXXXXXXX`) and a date window of
 * `[salonToday, salonToday + 30]` in `Asia/Tehran`.
 *
 * `publicSettingsSchema` validates the manager-edited public page settings.
 */
import { z } from 'zod'

import { addDaysYmd, salonTodayYmd } from '../salon-local-time'
import { normalizePhone } from '../phone'
import { PUBLIC_THEMES } from '../public-themes'
import { PUBLIC_LAYOUTS } from '../public-layouts'
import { formMessages } from './messages'
import {
  gregorianDateSchema,
  optionalTrimmedTextSchema,
  requiredTextSchema,
  timeOfDaySchema,
} from './primitives'

export const PUBLIC_BIO_MAX_LENGTH = 200

export const PUBLIC_REQUEST_WINDOW_DAYS = 30

/**
 * Iranian mobile phone in canonical `09XXXXXXXXX` form (11 digits, leading `09`).
 * Accepts Persian/Arabic digits and assorted separators.
 */
export const iranianMobilePhoneSchema = z
  .string({ required_error: formMessages.required })
  .trim()
  .min(1, formMessages.required)
  .transform((value) => normalizePhone(value))
  .pipe(z.string().regex(/^09\d{9}$/, formMessages.phoneInvalid))

const idSchema = z.string().trim().min(1)

export const publicAppointmentRequestSchema = z
  .object({
    serviceId: idSchema,
    date: gregorianDateSchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    customerName: requiredTextSchema,
    customerPhone: iranianMobilePhoneSchema,
    notes: optionalTrimmedTextSchema,
  })
  .superRefine((values, ctx) => {
    const today = salonTodayYmd()
    const maxDate = addDaysYmd(today, PUBLIC_REQUEST_WINDOW_DAYS)
    if (values.date < today || values.date > maxDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: formMessages.dateInvalid,
      })
    }
    if (values.endTime <= values.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: formMessages.endBeforeStart,
      })
    }
  })

export type PublicAppointmentRequestInput = z.input<typeof publicAppointmentRequestSchema>
export type PublicAppointmentRequestPayload = z.output<typeof publicAppointmentRequestSchema>

const serviceVisibilitySchema = z.object({
  serviceId: idSchema,
  visible: z.boolean(),
})

const themeIdSchema = z.enum(
  PUBLIC_THEMES.map((t) => t.id) as [string, ...string[]],
)

const layoutIdSchema = z.enum(
  PUBLIC_LAYOUTS.map((l) => l.id) as [string, ...string[]],
)

const bioSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  })
  .pipe(z.string().max(PUBLIC_BIO_MAX_LENGTH, formMessages.bioTooLong).optional())

export const publicSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  bioText: bioSchema,
  themeId: themeIdSchema.optional(),
  layoutId: layoutIdSchema.optional(),
  appointmentRequestsEnabled: z.boolean().optional(),
  services: z.array(serviceVisibilitySchema).optional(),
})

export type PublicSettingsInput = z.input<typeof publicSettingsSchema>
export type PublicSettingsPayload = z.output<typeof publicSettingsSchema>
