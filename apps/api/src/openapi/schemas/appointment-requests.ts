import { z } from '@hono/zod-openapi'

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

export const appointmentRequestListItemSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    serviceId: z.string(),
    staffId: z.string().nullable(),
    requestedDate: z.string().openapi({ example: '2026-06-07' }),
    requestedStartTime: z.string().openapi({ example: '10:00' }),
    requestedEndTime: z.string().openapi({ example: '11:00' }),
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
  .passthrough()
  .openapi('AppointmentRequestListItem')

export const appointmentRequestsListQuerySchema = z
  .object({
    status: appointmentRequestStatusSchema.optional().openapi({
      param: { name: 'status', in: 'query' },
      description:
        'Filter by request status. Defaults to pending on the server.',
    }),
  })
  .openapi('AppointmentRequestsListQuery')

export const appointmentRequestsListResponseSchema = z
  .object({
    requests: z.array(appointmentRequestListItemSchema),
  })
  .openapi('AppointmentRequestsListResponse')

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
