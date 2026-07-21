import { z } from '@hono/zod-openapi'
import { normalizeAcceptableDates } from '@repo/salon-core/appointment-request-timing'

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

const acceptableDatesSchema = z.array(z.string()).min(1)

function validateAcceptableDates(
  values: { acceptableDates: string[] },
  ctx: z.RefinementCtx,
) {
  try {
    normalizeAcceptableDates(values.acceptableDates)
  } catch {
    ctx.addIssue({
      code: 'custom',
      path: ['acceptableDates'],
      message: 'تاریخ‌ها باید معتبر، یکتا و در بازه مجاز باشند',
    })
  }
}

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
    acceptableDates: acceptableDatesSchema,
    timePreference: timePreferenceSchema,
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine(validateAcceptableDates)
  .openapi('CreateFlexibleAppointmentRequestRequest')

export const createFlexibleAppointmentRequestResponseSchema = z
  .object({ request: flexibleAppointmentRequestListItemSchema })
  .openapi('CreateFlexibleAppointmentRequestResponse')

export const renewTerminalAppointmentRequestBodySchema = z
  .object({
    acceptableDates: acceptableDatesSchema,
    timePreference: timePreferenceSchema,
    clientId: z.string().uuid().optional().openapi({
      description:
        'Required replacement only when the source Client is unavailable',
    }),
    serviceId: z.string().uuid().optional().openapi({
      description:
        'Required replacement only when the source ServiceVariant is unavailable',
    }),
  })
  .strict()
  .superRefine(validateAcceptableDates)
  .openapi('RenewTerminalAppointmentRequestRequest')

export const renewTerminalAppointmentRequestResponseSchema = z
  .object({ request: flexibleAppointmentRequestListItemSchema })
  .openapi('RenewTerminalAppointmentRequestResponse')

export const updateFlexibleAppointmentRequestBodySchema = z
  .object({
    acceptableDates: acceptableDatesSchema,
    timePreference: timePreferenceSchema,
    notes: z.string().max(2000).nullable(),
  })
  .strict()
  .superRefine(validateAcceptableDates)
  .openapi('UpdateFlexibleAppointmentRequestRequest')

export const updateFlexibleAppointmentRequestResponseSchema = z
  .object({ request: flexibleAppointmentRequestListItemSchema })
  .openapi('UpdateFlexibleAppointmentRequestResponse')

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
