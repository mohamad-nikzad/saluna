import type { ApiClient } from './client'
import { endpoints } from './endpoints'

export type AppointmentRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export type AppointmentRequestPaymentStatus = 'none' | 'pending' | 'paid'

export type AppointmentRequestListItem = {
  id: string
  salonId: string
  serviceId: string
  staffId: string | null
  requestedDate: string
  requestedStartTime: string
  requestedEndTime: string
  customerName: string
  customerPhone: string
  notes: string | null
  bookedServiceName: string
  bookedServiceDuration: number
  bookedServicePrice: number
  status: AppointmentRequestStatus
  paymentStatus: AppointmentRequestPaymentStatus
  depositAmount: number | null
  confirmationToken: string
  reviewedByUserId: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  appointmentId: string | null
  createdAt: string
  updatedAt: string
  existingClient: { id: string; name: string } | null
}

export type ListAppointmentRequestsResponse = {
  requests: AppointmentRequestListItem[]
}

export type ApproveAppointmentRequestInput = { staffId: string }
export type ApproveAppointmentRequestResponse = {
  appointmentId: string
  clientId: string
}

export type RejectAppointmentRequestInput = { reason?: string }
export type RejectAppointmentRequestResponse = { ok: true }

export function createAppointmentRequestsApi(client: ApiClient) {
  return {
    list(
      opts: { status?: AppointmentRequestStatus; signal?: AbortSignal } = {},
    ) {
      const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : ''
      return client.request<ListAppointmentRequestsResponse>(
        `${endpoints.appointmentRequests}${qs}`,
        { signal: opts.signal },
      )
    },
    approve(
      id: string,
      input: ApproveAppointmentRequestInput,
      opts: { signal?: AbortSignal } = {},
    ) {
      return client.request<ApproveAppointmentRequestResponse>(
        `${endpoints.appointmentRequests}/${id}/approve`,
        { method: 'POST', body: input, signal: opts.signal },
      )
    },
    reject(
      id: string,
      input: RejectAppointmentRequestInput = {},
      opts: { signal?: AbortSignal } = {},
    ) {
      return client.request<RejectAppointmentRequestResponse>(
        `${endpoints.appointmentRequests}/${id}/reject`,
        {
          method: 'POST',
          body: input.reason ? { reason: input.reason } : {},
          signal: opts.signal,
        },
      )
    },
  }
}

export type AppointmentRequestsApi = ReturnType<typeof createAppointmentRequestsApi>
