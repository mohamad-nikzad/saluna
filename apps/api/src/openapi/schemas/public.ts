import { z } from '@hono/zod-openapi'
import { publicAppointmentRequestSchema } from '@repo/salon-core/forms/public'

import { appointmentRequestStatusSchema } from './appointment-requests'
import { availabilityResponseSchema } from './appointments'
import { salonPresenceSchema } from './salon-profile'
import { serviceSchema } from './services'

const isoDateTimeSchema = z.string().datetime().or(z.string())

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

export const publicSlugParamSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'slug', in: 'path' },
        example: 'my-salon',
      }),
  })
  .openapi('PublicSlugParam')

export const publicSlugTokenParamSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'slug', in: 'path' },
        example: 'my-salon',
      }),
    token: z
      .string()
      .uuid()
      .openapi({
        param: { name: 'token', in: 'path' },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
  })
  .openapi('PublicSlugTokenParam')

export const publicSalonInfoSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    timezone: z.string(),
    locale: z.string(),
  })
  .openapi('PublicSalonInfo')

export const publicSalonSettingsSchema = z
  .object({
    enabled: z.boolean(),
    bioText: z.string().nullable(),
    themeId: z.string(),
    layoutId: z.string(),
    appointmentRequestsEnabled: z.boolean(),
  })
  .openapi('PublicSalonSettings')

export const publicSalonViewSchema = z
  .object({
    salon: publicSalonInfoSchema,
    publicSettings: publicSalonSettingsSchema,
    presence: salonPresenceSchema,
    services: z.array(serviceSchema),
  })
  .openapi('PublicSalonView')

export const publicAvailabilityQuerySchema = z
  .object({
    serviceId: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'serviceId', in: 'query' },
      }),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .openapi({
        param: { name: 'date', in: 'query' },
        example: '2026-06-07',
      }),
    mode: z
      .enum(['day', 'nearest'])
      .optional()
      .default('day')
      .openapi({
        param: { name: 'mode', in: 'query' },
        example: 'day',
      }),
    days: z
      .string()
      .optional()
      .openapi({
        param: { name: 'days', in: 'query' },
        description: 'Nearest-mode search window in days (max 60).',
      }),
  })
  .openapi('PublicAvailabilityQuery')

export const publicAppointmentRequestBodySchema = bodyFromCoreSchema(
  'PublicAppointmentRequestBody',
  {
    serviceId: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    customerName: z.string(),
    customerPhone: z.string(),
    notes: z.string().optional(),
  },
  publicAppointmentRequestSchema,
)

export const publicAppointmentRequestCreatedSchema = z
  .object({
    token: z.string(),
  })
  .openapi('PublicAppointmentRequestCreated')

export const publicSalonSummarySchema = z
  .object({
    name: z.string(),
    phone: z.string().nullable(),
  })
  .openapi('PublicSalonSummary')

export const publicAppointmentRequestStatusViewSchema = z
  .object({
    id: z.string(),
    status: appointmentRequestStatusSchema,
    bookedServiceName: z.string(),
    bookedServiceDuration: z.number().int(),
    bookedServicePrice: z.number().int(),
    requestedDate: z.string(),
    requestedStartTime: z.string(),
    requestedEndTime: z.string(),
    salon: publicSalonSummarySchema,
    createdAt: isoDateTimeSchema,
    reviewedAt: isoDateTimeSchema.nullable(),
    rejectionReason: z.string().nullable(),
  })
  .openapi('PublicAppointmentRequestStatusView')

export const publicCancelAppointmentRequestResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi('PublicCancelAppointmentRequestResponse')

export { availabilityResponseSchema as publicAvailabilityResponseSchema }
