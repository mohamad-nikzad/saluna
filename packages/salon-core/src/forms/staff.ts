/**
 * Staff form schemas shared by Saluna clients.
 * Covers staff creation and weekly working-schedule editing.
 */
import { z } from 'zod'

import { normalizeCalendarColorId } from '../calendar-colors'
import { STAFF_COLORS } from '../types'
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

const passwordSchema = z
  .string({ error: formMessages.required })
  .min(MIN_PASSWORD_LENGTH, formMessages.passwordTooShort)

/** API / data-client payload — confirm-password is form-only UX. */
export const staffCreateRequestSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
  password: passwordSchema,
  role: staffRoleSchema.default('staff'),
})

export type StaffCreateRequestPayload = z.output<
  typeof staffCreateRequestSchema
>

export const staffCreateSchema = staffCreateRequestSchema
  .extend({
    confirmPassword: z.string({ error: formMessages.required }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: formMessages.passwordMismatch,
      })
    }
  })
  .transform(({ confirmPassword: _confirmPassword, ...payload }) => payload)

export type StaffCreateFormInput = z.input<typeof staffCreateSchema>
/** Parsed form output — same shape as {@link StaffCreateRequestPayload}. */
export type StaffCreateFormPayload = StaffCreateRequestPayload

export const staffUpdateSchema = z.object({
  name: requiredTextSchema,
  nickname: z
    .string()
    .trim()
    .max(40, 'نام نمایشی حداکثر ۴۰ کاراکتر است')
    .optional()
    .nullable()
    .transform((value) => {
      const normalized = value?.trim()
      return normalized ? normalized : null
    }),
  phone: phoneSchema,
  role: staffRoleSchema,
  color: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => normalizeCalendarColorId(value ?? STAFF_COLORS[0])),
})

export type StaffUpdateFormInput = z.input<typeof staffUpdateSchema>
export type StaffUpdateFormPayload = z.output<typeof staffUpdateSchema>

export const staffPasswordRequestSchema = z.object({
  password: passwordSchema,
})

export type StaffPasswordRequestInput = z.input<
  typeof staffPasswordRequestSchema
>
export type StaffPasswordRequestPayload = z.output<
  typeof staffPasswordRequestSchema
>

export const staffPasswordUpdateSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string({ error: formMessages.required }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: formMessages.passwordMismatch,
      })
    }
  })
  .transform(({ confirmPassword: _confirmPassword, password }) => ({
    password,
  }))

export type StaffPasswordUpdateInput = z.input<typeof staffPasswordUpdateSchema>
export type StaffPasswordUpdatePayload = z.output<
  typeof staffPasswordUpdateSchema
>

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
export type StaffScheduleRequestInput = z.input<
  typeof staffScheduleRequestSchema
>
export type StaffScheduleRequestPayload = z.output<
  typeof staffScheduleRequestSchema
>
export type StaffServiceIdsInput = z.input<typeof staffServiceIdsSchema>
export type StaffServiceIdsPayload = z.output<typeof staffServiceIdsSchema>
