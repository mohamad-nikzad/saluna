import { z } from '@hono/zod-openapi'
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  completePlaceholderClientSchema,
} from '@repo/salon-core/forms/appointment'
import { AVAILABILITY_EMPTY_REASONS } from '@repo/salon-core/availability'
import { appointmentWithDetailsSchema, clientSchema } from './clients'

function bodyFromCoreSchema<T extends z.ZodType>(
  name: string,
  shape: z.ZodRawShape,
  coreSchema: T,
) {
  return z
    .object(shape)
    .openapi(name)
    .superRefine((data, ctx) => {
      const result = coreSchema.safeParse(data)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: issue.path,
          })
        }
      }
    })
    .transform((data) => coreSchema.parse(data))
}

export const appointmentCreateBodySchema = bodyFromCoreSchema(
  'AppointmentCreateRequest',
  {
    id: z.string().optional().openapi({
      description: 'Optional client-provided UUID for offline-first sync',
    }),
    clientId: z.string().optional(),
    placeholderClient: z
      .object({
        name: z.string(),
        notes: z.string().optional(),
      })
      .optional(),
    staffId: z.string(),
    serviceId: z.string(),
    addonIds: z.array(z.string()).optional(),
    date: z.string().openapi({ example: '2026-06-07' }),
    startTime: z.string().openapi({ example: '10:00' }),
    endTime: z.string().optional().openapi({ example: '11:00' }),
    durationMinutes: z.number().optional(),
    finalPrice: z.number().optional(),
    notes: z.string().optional(),
  },
  appointmentCreateSchema,
)

export const appointmentUpdateBodySchema = bodyFromCoreSchema(
  'AppointmentUpdateRequest',
  {
    clientId: z.string().optional(),
    placeholderClient: z
      .object({
        name: z.string(),
        notes: z.string().optional(),
      })
      .optional(),
    staffId: z.string().optional(),
    serviceId: z.string().optional(),
    addonIds: z.array(z.string()).optional(),
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    durationMinutes: z.number().optional(),
    status: z
      .enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'])
      .optional(),
    notes: z.string().optional(),
  },
  appointmentUpdateSchema,
)

export const completePlaceholderClientBodySchema = bodyFromCoreSchema(
  'CompletePlaceholderClientRequest',
  {
    name: z.string(),
    phone: z.string(),
    notes: z.string().optional(),
    reassignToExistingClientId: z.string().optional(),
  },
  completePlaceholderClientSchema,
)

export const appointmentsListQuerySchema = z
  .object({
    startDate: z.string().openapi({
      param: { name: 'startDate', in: 'query' },
      example: '2026-01-01',
    }),
    endDate: z.string().openapi({
      param: { name: 'endDate', in: 'query' },
      example: '2026-12-31',
    }),
  })
  .openapi('AppointmentsListQuery')

export const availabilityQuerySchema = z
  .object({
    mode: z.enum(['day', 'nearest']).openapi({
      param: { name: 'mode', in: 'query' },
      example: 'day',
    }),
    serviceId: z.string().openapi({
      param: { name: 'serviceId', in: 'query' },
    }),
    date: z.string().openapi({
      param: { name: 'date', in: 'query' },
      example: '2026-06-07',
    }),
    staffId: z
      .string()
      .optional()
      .openapi({
        param: { name: 'staffId', in: 'query' },
      }),
  })
  .openapi('AppointmentAvailabilityQuery')

const availabilityEmptyReasonSchema = z
  .enum([
    AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF,
    AVAILABILITY_EMPTY_REASONS.SALON_CLOSED,
    AVAILABILITY_EMPTY_REASONS.STAFF_OFF_DAY,
    AVAILABILITY_EMPTY_REASONS.ALL_QUALIFIED_STAFF_OFF_DAY,
    AVAILABILITY_EMPTY_REASONS.FULLY_BOOKED,
    AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW,
  ])
  .openapi('AvailabilityEmptyReason')

export const availabilitySlotSchema = z
  .object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    staffId: z.string(),
    staffName: z.string(),
  })
  .openapi('AvailabilitySlot')

export const dayAvailabilityResponseSchema = z
  .object({
    mode: z.literal('day'),
    slots: z.array(availabilitySlotSchema),
    emptyReason: availabilityEmptyReasonSchema.optional(),
  })
  .openapi('DayAvailabilityResponse')

export const nearestAvailabilityResponseSchema = z
  .object({
    mode: z.literal('nearest'),
    slot: availabilitySlotSchema.nullable(),
    emptyReason: availabilityEmptyReasonSchema.optional(),
  })
  .openapi('NearestAvailabilityResponse')

export const availabilityResponseSchema = z
  .union([dayAvailabilityResponseSchema, nearestAvailabilityResponseSchema])
  .openapi('AvailabilityResponse')

export const appointmentsListResponseSchema = z
  .object({
    appointments: z.array(appointmentWithDetailsSchema),
  })
  .openapi('AppointmentsListResponse')

export const appointmentResponseSchema = z
  .object({
    appointment: appointmentWithDetailsSchema,
  })
  .openapi('AppointmentResponse')

export const appointmentUpdateResponseSchema = z
  .union([
    appointmentResponseSchema,
    z
      .object({
        success: z.literal(true),
        removedAppointmentId: z.string(),
        cleanup: z.literal(true),
      })
      .openapi('AppointmentCleanupResponse'),
  ])
  .openapi('AppointmentUpdateResponse')

export const appointmentDeleteResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .openapi('AppointmentDeleteResponse')

export const completePlaceholderClientResponseSchema = z
  .object({
    appointment: appointmentWithDetailsSchema,
    outcome: z.enum(['created-client', 'reassigned-client']),
  })
  .openapi('CompletePlaceholderClientResponse')

export const duplicateClientErrorSchema = z
  .object({
    error: z.string(),
    code: z.literal('duplicate-phone'),
    existingClient: clientSchema.optional(),
  })
  .openapi('DuplicateClientError')
