/**
 * Staff form schemas — shared between PWA (`apps/pwa`) and native (`apps/native`).
 * Covers staff creation and weekly working-schedule editing.
 */
import { z } from 'zod'

import { formMessages } from './messages'
import {
  phoneSchema,
  requiredTextSchema,
  timeOfDaySchema,
  timeToMinutes,
} from './primitives'

const MIN_PASSWORD_LENGTH = 8

export const staffRoleSchema = z.enum(['staff', 'manager'])
export type StaffRole = z.infer<typeof staffRoleSchema>

export const staffCreateSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
  password: z
    .string({ error: formMessages.required })
    .min(MIN_PASSWORD_LENGTH, formMessages.passwordTooShort),
  role: staffRoleSchema.default('staff'),
})

export type StaffCreateFormInput = z.input<typeof staffCreateSchema>
export type StaffCreateFormPayload = z.output<typeof staffCreateSchema>

export const staffScheduleDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    active: z.boolean(),
    workingStart: timeOfDaySchema,
    workingEnd: timeOfDaySchema,
  })
  .superRefine((row, ctx) => {
    if (!row.active) return
    if (timeToMinutes(row.workingEnd) <= timeToMinutes(row.workingStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['workingEnd'],
        message: formMessages.endBeforeStart,
      })
    }
  })

export const staffScheduleSchema = z.array(staffScheduleDaySchema)

export const staffScheduleRequestSchema = z.object({
  schedule: staffScheduleSchema.min(1, 'برنامه هفتگی خالی است'),
})

export const staffServiceIdsSchema = z.object({
  serviceIds: z
    .array(z.string())
    .optional()
    .nullable()
    .transform((ids) => {
      if (ids == null) return null
      const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
      return unique.length === 0 ? null : unique
    }),
})

export type StaffScheduleDayInput = z.input<typeof staffScheduleDaySchema>
export type StaffScheduleDayPayload = z.output<typeof staffScheduleDaySchema>
export type StaffScheduleFormInput = z.input<typeof staffScheduleSchema>
export type StaffScheduleFormPayload = z.output<typeof staffScheduleSchema>
export type StaffScheduleRequestInput = z.input<typeof staffScheduleRequestSchema>
export type StaffScheduleRequestPayload = z.output<typeof staffScheduleRequestSchema>
export type StaffServiceIdsInput = z.input<typeof staffServiceIdsSchema>
export type StaffServiceIdsPayload = z.output<typeof staffServiceIdsSchema>
