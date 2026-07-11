import { z } from '@hono/zod-openapi'
import {
  clientBulkCreateItemSchema,
  clientBulkCreateSchema,
  clientCreateSchema,
  clientUpdateSchema,
} from '@repo/salon-core/forms/client'

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

export const clientCreateBodySchema = bodyFromCoreSchema(
  'ClientCreateRequest',
  {
    name: z.string().openapi({ example: 'علی رضایی' }),
    phone: z.string().openapi({ example: '09121234567' }),
    notes: z
      .string()
      .optional()
      .openapi({ example: 'ترجیح می‌دهد صبح‌ها بیاید' }),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ example: ['VIP'] }),
    id: z.string().optional().openapi({
      example: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Optional client-provided UUID for offline-first sync',
    }),
  },
  clientCreateSchema,
)

export const clientUpdateBodySchema = bodyFromCoreSchema(
  'ClientUpdateRequest',
  {
    name: z.string().optional().openapi({ example: 'علی رضایی' }),
    phone: z.string().optional().openapi({ example: '09121234567' }),
    notes: z.string().optional(),
    tags: z
      .array(z.string())
      .optional()
      .openapi({ example: ['VIP'] }),
  },
  clientUpdateSchema,
)

const clientBulkCreateItemShape = {
  name: z.string().openapi({ example: 'علی رضایی' }),
  phone: z.string().openapi({ example: '09121234567' }),
}

export const clientBulkCreateItemSchemaOpenApi = bodyFromCoreSchema(
  'ClientBulkCreateItem',
  clientBulkCreateItemShape,
  clientBulkCreateItemSchema,
)

export const clientBulkCreateBodySchemaOpenApi = bodyFromCoreSchema(
  'ClientBulkCreateRequest',
  {
    clients: z
      .array(z.object(clientBulkCreateItemShape))
      .min(1)
      .openapi({
        example: [{ name: 'علی رضایی', phone: '09121234567' }],
      }),
  },
  clientBulkCreateSchema,
)

export const clientBulkSkippedSchema = z
  .object({
    phone: z.string().openapi({ example: '09121234567' }),
    reason: z
      .enum(['duplicate-phone', 'invalid'])
      .openapi({ example: 'duplicate-phone' }),
  })
  .openapi('ClientBulkCreateSkipped')

export const followUpReasonSchema = z
  .enum(['inactive', 'no-show', 'new-client', 'vip', 'manual'])
  .openapi('FollowUpReason')

export const followUpBodySchema = z
  .object({
    reason: z.string().optional().openapi({
      example: 'manual',
      description:
        'Follow-up reason; unknown values default to manual server-side',
    }),
    dueDate: z.string().optional().openapi({ example: '2026-06-15' }),
  })
  .openapi('ClientFollowUpCreateRequest')

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const clientTagSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    clientId: z.string(),
    label: z.string(),
    color: z.string(),
    createdAt: isoDateTimeSchema,
  })
  .openapi('ClientTag')

export const clientSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    isPlaceholder: z.boolean(),
    notes: z.string().optional(),
    createdAt: isoDateTimeSchema,
    tags: z.array(clientTagSchema).optional(),
  })
  .openapi('Client')

export const clientBulkCreateResponseSchema = z
  .object({
    created: z.array(clientSchema),
    skipped: z.array(clientBulkSkippedSchema),
  })
  .openapi('ClientBulkCreateResponse')

export const clientsListResponseSchema = z
  .object({
    clients: z.array(clientSchema),
  })
  .openapi('ClientsListResponse')

export const clientResponseSchema = z
  .object({
    client: clientSchema,
  })
  .openapi('ClientResponse')

export const followUpStatusSchema = z
  .enum(['open', 'reviewed', 'dismissed'])
  .openapi('FollowUpStatus')

export const clientFollowUpSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    clientId: z.string(),
    reason: followUpReasonSchema,
    status: followUpStatusSchema,
    dueDate: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    reviewedAt: isoDateTimeSchema.nullable(),
  })
  .openapi('ClientFollowUp')

export const clientFollowUpResponseSchema = z
  .object({
    followUp: clientFollowUpSchema,
  })
  .openapi('ClientFollowUpResponse')

const userSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable().optional(),
    role: z.string().optional(),
    createdAt: isoDateTimeSchema.optional(),
  })
  .passthrough()
  .openapi('User')

const serviceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    duration: z.number().optional(),
    price: z.number().optional(),
  })
  .passthrough()
  .openapi('Service')

const bookedAddonSchema = z
  .object({
    id: z.string(),
    appointmentId: z.string(),
    serviceAddonId: z.string(),
    bookedAddonName: z.string(),
    bookedAddonPriceDelta: z.number(),
    bookedAddonDurationDelta: z.number(),
    sortOrder: z.number(),
    createdAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('BookedAppointmentAddonLine')

export const appointmentWithDetailsSchema = z
  .object({
    id: z.string(),
    clientId: z.string(),
    staffId: z.string(),
    serviceId: z.string(),
    bookedServiceName: z.string(),
    bookedServiceDuration: z.number(),
    bookedServicePrice: z.number(),
    bookedTotalDuration: z.number(),
    bookedTotalPrice: z.number(),
    bookedAddonCount: z.number(),
    bookedAddons: z.array(bookedAddonSchema).optional(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    status: z.enum([
      'scheduled',
      'confirmed',
      'completed',
      'cancelled',
      'no-show',
    ]),
    notes: z.string().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    client: clientSchema,
    staff: userSchema,
    service: serviceSchema,
  })
  .passthrough()
  .openapi('AppointmentWithDetails')

export const clientSummarySchema = z
  .object({
    client: clientSchema,
    tags: z.array(clientTagSchema),
    upcomingAppointment: appointmentWithDetailsSchema.nullable(),
    history: z.array(appointmentWithDetailsSchema),
    stats: z.object({
      completedCount: z.number(),
      cancelledCount: z.number(),
      noShowCount: z.number(),
      estimatedSpend: z.number(),
      lastVisitDate: z.string().nullable(),
      favoriteServiceName: z.string().nullable(),
      lastStaffName: z.string().nullable(),
      totalCompletedVisits: z.number(),
    }),
    openFollowUps: z.array(clientFollowUpSchema),
  })
  .openapi('ClientSummary')
