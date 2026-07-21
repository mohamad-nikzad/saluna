import { z } from '@hono/zod-openapi'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const appointmentRequestStatusSchema = z
  .enum(['pending', 'approved', 'rejected', 'cancelled', 'expired'])
  .openapi('AppointmentRequestStatus')

export const appointmentRequestPaymentStatusSchema = z
  .enum(['none', 'pending', 'paid'])
  .openapi('AppointmentRequestPaymentStatus')

export const appointmentRequestExistingClientSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('AppointmentRequestExistingClient')

const appointmentRequestListItemBaseSchema = z.object({
  id: z.string(),
  salonId: z.string(),
  serviceId: z.string(),
  clientId: z.string().nullable(),
  staffId: z.string().nullable(),
  customerName: z.string(),
  customerPhone: z.string(),
  notes: z.string().nullable(),
  bookedServiceName: z.string(),
  bookedServiceDuration: z.number().int(),
  bookedServicePrice: z.number().int(),
  status: appointmentRequestStatusSchema,
  paymentStatus: appointmentRequestPaymentStatusSchema,
  depositAmount: z.number().int().nullable(),
  confirmationToken: z.string(),
  reviewedByUserId: z.string().nullable(),
  reviewedAt: isoDateTimeSchema.nullable(),
  rejectionReason: z.string().nullable(),
  appointmentId: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  existingClient: appointmentRequestExistingClientSchema.nullable(),
})

const exactAppointmentRequestListItemSchema =
  appointmentRequestListItemBaseSchema
    .extend({
      timingMode: z.literal('exact'),
      requestedDate: z.string().openapi({ example: '2026-06-07' }),
      requestedStartTime: z.string().openapi({ example: '10:00' }),
      requestedEndTime: z.string().openapi({ example: '11:00' }),
      acceptableDates: z.null(),
      timePreference: z.null(),
    })
    .openapi('ExactAppointmentRequestListItem')

export const timePreferenceSchema = z
  .enum(['morning', 'afternoon', 'evening', 'any'])
  .openapi('TimePreference')

const flexibleAppointmentRequestListItemSchema =
  appointmentRequestListItemBaseSchema
    .extend({
      timingMode: z.literal('flexible'),
      clientId: z.string(),
      requestedDate: z.null(),
      requestedStartTime: z.null(),
      requestedEndTime: z.null(),
      acceptableDates: z.array(z.string()).min(1),
      timePreference: timePreferenceSchema,
      closureNote: z.string().nullable(),
      existingClient: z.object({ id: z.string(), name: z.string() }),
    })
    .openapi('FlexibleAppointmentRequestListItem')

export const appointmentRequestListItemSchema = z
  .discriminatedUnion('timingMode', [
    exactAppointmentRequestListItemSchema,
    flexibleAppointmentRequestListItemSchema,
  ])
  .openapi('AppointmentRequestListItem')

export const appointmentRequestsListQuerySchema = z
  .object({
    status: appointmentRequestStatusSchema.optional().openapi({
      param: { name: 'status', in: 'query' },
      description:
        'Filter by request status. Defaults to pending on the server.',
    }),
    timingMode: z
      .enum(['exact', 'flexible'])
      .optional()
      .openapi({
        param: { name: 'timingMode', in: 'query' },
      }),
  })
  .openapi('AppointmentRequestsListQuery')

export const appointmentRequestsListResponseSchema = z
  .object({
    requests: z.array(appointmentRequestListItemSchema),
  })
  .openapi('AppointmentRequestsListResponse')

export const createFlexibleAppointmentRequestBodySchema = z
  .object({
    clientId: z.string().uuid(),
    serviceId: z.string().uuid(),
    acceptableDates: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .min(1)
      .refine((dates) =>
        dates.every((date) => {
          const parsed = new Date(`${date}T00:00:00Z`)
          return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === date
          )
        }),
      )
      .refine((dates) => new Set(dates).size === dates.length),
    timePreference: timePreferenceSchema,
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((values, ctx) => {
    const today = salonTodayYmd()
    const maxDate = addDaysYmd(today, 30)
    if (values.acceptableDates.some((date) => date < today || date > maxDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['acceptableDates'],
        message: 'تاریخ خارج از بازه مجاز است',
      })
    }
  })
  .openapi('CreateFlexibleAppointmentRequestRequest')

export const createFlexibleAppointmentRequestResponseSchema = z
  .object({ request: flexibleAppointmentRequestListItemSchema })
  .openapi('CreateFlexibleAppointmentRequestResponse')

export const approveAppointmentRequestBodySchema = z
  .object({
    staffId: z.string().min(1).openapi({
      description:
        'Staff member assigned when converting the request to an appointment',
    }),
  })
  .openapi('ApproveAppointmentRequestRequest')

export const approveAppointmentRequestResponseSchema = z
  .object({
    appointmentId: z.string(),
    clientId: z.string(),
  })
  .openapi('ApproveAppointmentRequestResponse')

export const rejectAppointmentRequestBodySchema = z
  .object({
    reason: z.string().trim().min(1).optional().openapi({
      description: 'Optional rejection reason shown to salon staff',
    }),
  })
  .openapi('RejectAppointmentRequestRequest')

export const rejectAppointmentRequestResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi('RejectAppointmentRequestResponse')

export const cancelAppointmentRequestBodySchema = z
  .object({
    closureNote: z.string().trim().min(1).optional().openapi({
      description: 'Optional note explaining the customer withdrawal',
    }),
  })
  .openapi('CancelAppointmentRequestRequest')

export const cancelAppointmentRequestResponseSchema = z
  .object({ ok: z.literal(true) })
  .openapi('CancelAppointmentRequestResponse')
