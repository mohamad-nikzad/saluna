import { z } from 'zod'

import { formMessages } from './messages'
import { durationMinutesSchema, timeOfDaySchema, timeToMinutes } from './primitives'

/**
 * Salon working-days bitmask. Bit 0 = Saturday … bit 6 = Friday.
 * Range 0–127 covers all seven days. See ADR-0004.
 */
export const workingDaysSchema = z
  .number({ error: formMessages.numberInvalid })
  .int(formMessages.numberInvalid)
  .min(0, formMessages.numberInvalid)
  .max(127, formMessages.numberInvalid)
  .superRefine((value, ctx) => {
    if (value === 0) {
      ctx.addIssue({
        code: 'custom',
        message: formMessages.workingDaysRequired,
      })
    }
  })

export const businessSettingsSchema = z
  .object({
    workingStart: timeOfDaySchema.optional(),
    workingEnd: timeOfDaySchema.optional(),
    slotDurationMinutes: durationMinutesSchema.optional(),
    workingDays: workingDaysSchema.optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.workingStart || !values.workingEnd) return
    if (timeToMinutes(values.workingEnd) <= timeToMinutes(values.workingStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['workingEnd'],
        message: formMessages.endBeforeStart,
      })
    }
  })

export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>
export type BusinessSettingsPayload = z.output<typeof businessSettingsSchema>
