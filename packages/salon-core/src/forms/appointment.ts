/**
 * Appointment form schemas shared by web and native.
 * The form schema accepts UI-only fields and emits the API create payload.
 */
import { z } from 'zod'

import {
  APPOINTMENT_DURATION_BOUNDS,
  durationMinutesFromRange,
} from '../appointment-time'
import { APPOINTMENT_STATUS } from '../types'
import { formMessages } from './messages'
import {
  durationMinutesSchema,
  gregorianDateSchema,
  phoneSchema,
  optionalTrimmedTextSchema,
  requiredTextSchema,
  nonNegativeMoneySchema,
  timeOfDaySchema,
} from './primitives'

const idSchema = z.string().trim().min(1)
const addonIdsSchema = z.array(idSchema).optional()
const appointmentStatusKeys = Object.keys(APPOINTMENT_STATUS) as [
  keyof typeof APPOINTMENT_STATUS,
  ...(keyof typeof APPOINTMENT_STATUS)[],
]
const appointmentStatusSchema = z.enum(appointmentStatusKeys)

const appointmentBaseSchema = z.object({
  staffId: idSchema,
  serviceId: idSchema,
  addonIds: addonIdsSchema,
  date: gregorianDateSchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema.optional(),
  durationMinutes: durationMinutesSchema.optional(),
  finalPrice: nonNegativeMoneySchema.optional(),
  notes: optionalTrimmedTextSchema,
})

function validateAppointmentRange(
  values: { startTime: string; endTime?: string },
  ctx: z.RefinementCtx,
) {
  if (!values.endTime) return
  const duration = durationMinutesFromRange(values.startTime, values.endTime)
  if (duration <= 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['endTime'],
      message: formMessages.endBeforeStart,
    })
    return
  }
  if (
    duration < APPOINTMENT_DURATION_BOUNDS.min ||
    duration > APPOINTMENT_DURATION_BOUNDS.max
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['durationMinutes'],
      message: `مدت نوبت باید بین ${APPOINTMENT_DURATION_BOUNDS.min} و ${APPOINTMENT_DURATION_BOUNDS.max} دقیقه باشد`,
    })
  }
}

export const appointmentCreateSchema = appointmentBaseSchema
  .extend({
    id: z.string().optional(),
    clientId: z.string().trim().optional(),
    placeholderClient: z
      .object({
        name: requiredTextSchema,
        notes: optionalTrimmedTextSchema,
      })
      .optional(),
  })
  .superRefine((values, ctx) => {
    validateAppointmentRange(values, ctx)
    const hasClient =
      typeof values.clientId === 'string' && values.clientId.trim() !== ''
    const hasPlaceholder = values.placeholderClient != null
    if (hasClient === hasPlaceholder) {
      ctx.addIssue({
        code: 'custom',
        path: ['clientId'],
        message: formMessages.clientRequired,
      })
    }
  })
  .transform((values) => ({
    ...values,
    clientId:
      typeof values.clientId === 'string' && values.clientId.trim() !== ''
        ? values.clientId.trim()
        : undefined,
  }))

export const appointmentUpdateSchema = z.object({
  clientId: z.string().trim().optional(),
  placeholderClient: z
    .object({
      name: requiredTextSchema,
      notes: optionalTrimmedTextSchema,
    })
    .optional(),
  staffId: z.string().trim().optional(),
  serviceId: z.string().trim().optional(),
  addonIds: addonIdsSchema,
  date: gregorianDateSchema.optional(),
  startTime: timeOfDaySchema.optional(),
  endTime: timeOfDaySchema.optional(),
  durationMinutes: durationMinutesSchema.optional(),
  finalPrice: nonNegativeMoneySchema.optional(),
  status: appointmentStatusSchema.optional(),
  notes: optionalTrimmedTextSchema,
})

export const completePlaceholderClientSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
  notes: optionalTrimmedTextSchema,
  reassignToExistingClientId: z.string().trim().optional(),
})

export const availabilitySearchSchema = z.object({
  serviceId: idSchema,
  staffSelection: z.string().default('__any__'),
  date: gregorianDateSchema,
})

export const appointmentFormSchema = z
  .object({
    useTemporaryClient: z.boolean().default(false),
    clientId: z.string().optional(),
    temporaryClientName: z.string().optional(),
    temporaryClientNotes: z.string().optional(),
    staffId: z.string().optional(),
    serviceId: z.string().optional(),
    addonIds: z.array(z.string()).optional(),
    date: gregorianDateSchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
    durationMinutes: durationMinutesSchema,
    finalPrice: nonNegativeMoneySchema.optional(),
    notes: optionalTrimmedTextSchema,
  })
  .superRefine((values, ctx) => {
    if (values.useTemporaryClient) {
      if (!values.temporaryClientName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['temporaryClientName'],
          message: formMessages.temporaryClientNameRequired,
        })
      }
    } else if (!values.clientId?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['clientId'],
        message: formMessages.clientRequired,
      })
    }
    if (!values.staffId?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['staffId'],
        message: formMessages.staffRequired,
      })
    }
    if (!values.serviceId?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['serviceId'],
        message: formMessages.serviceRequired,
      })
    }
    validateAppointmentRange(values, ctx)
  })
  .transform((values, ctx) => {
    const payload = appointmentCreateSchema.safeParse({
      ...(values.useTemporaryClient
        ? {
            placeholderClient: {
              name: values.temporaryClientName,
              notes: values.temporaryClientNotes,
            },
          }
        : { clientId: values.clientId }),
      staffId: values.staffId,
      serviceId: values.serviceId,
      addonIds: values.addonIds,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      durationMinutes: values.durationMinutes,
      finalPrice: values.finalPrice,
      notes: values.notes,
    })
    if (!payload.success) {
      for (const issue of payload.error.issues)
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        })
      return z.NEVER
    }
    return payload.data
  })

export type AppointmentCreateInput = z.input<typeof appointmentCreateSchema>
export type AppointmentCreatePayload = z.output<typeof appointmentCreateSchema>
export type AppointmentUpdateInput = z.input<typeof appointmentUpdateSchema>
export type AppointmentUpdatePayload = z.output<typeof appointmentUpdateSchema>
export type CompletePlaceholderClientInput = z.input<
  typeof completePlaceholderClientSchema
>
export type CompletePlaceholderClientPayload = z.output<
  typeof completePlaceholderClientSchema
>
export type AvailabilitySearchInput = z.input<typeof availabilitySearchSchema>
export type AvailabilitySearchPayload = z.output<
  typeof availabilitySearchSchema
>
export type AppointmentFormInput = z.input<typeof appointmentFormSchema>
export type AppointmentFormPayload = z.output<typeof appointmentFormSchema>
