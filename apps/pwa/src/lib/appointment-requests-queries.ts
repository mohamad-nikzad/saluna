import { queryOptions, useMutation } from '@tanstack/react-query'
import { getApiV1AppointmentRequests } from '@repo/api-client/sdk'
import {
  getApiV1AppointmentRequestsQueryKey,
  postApiV1AppointmentRequestsByIdApproveMutation,
  postApiV1AppointmentRequestsByIdCancelMutation,
  postApiV1AppointmentRequestsByIdRejectMutation,
  postApiV1AppointmentRequestsMutation,
} from '@repo/api-client/query'
import type {
  AppointmentRequestListItem,
  AppointmentRequestStatus,
  AppointmentRequestsListResponse,
  CreateFlexibleAppointmentRequestRequest,
  ExactAppointmentRequestListItem,
  FlexibleAppointmentRequestListItem,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1AppointmentRequestsQueryKey }
export type {
  AppointmentRequestListItem,
  AppointmentRequestStatus,
  AppointmentRequestsListResponse,
  ExactAppointmentRequestListItem,
  FlexibleAppointmentRequestListItem,
}

export function appointmentRequestsInvalidationKeys() {
  return [[{ _id: 'getApiV1AppointmentRequests' }]] as const
}

export function appointmentRequestsListQueryOptions(
  status: AppointmentRequestStatus,
  timingMode?: 'exact' | 'flexible',
) {
  const query = { status, ...(timingMode ? { timingMode } : {}) }
  return queryOptions({
    queryKey: getApiV1AppointmentRequestsQueryKey({ query }),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<AppointmentRequestsListResponse> => {
      const { data } = await getApiV1AppointmentRequests({
        query,
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function pendingAppointmentRequestsQueryOptions() {
  return appointmentRequestsListQueryOptions('pending', 'exact')
}

export function pendingDraftsQueryOptions() {
  return appointmentRequestsListQueryOptions('pending', 'flexible')
}

export function useCreateDraftMutation() {
  const generated = postApiV1AppointmentRequestsMutation()
  return useMutation({
    mutationFn: async (
      body: CreateFlexibleAppointmentRequestRequest,
      mutationContext,
    ) => generated.mutationFn!({ body }, mutationContext),
    meta: {
      invalidatesQuery: appointmentRequestsInvalidationKeys(),
      errorMessage: 'ثبت پیش‌نویس انجام نشد',
    },
  })
}

export function useApproveAppointmentRequestMutation() {
  const generated = postApiV1AppointmentRequestsByIdApproveMutation()

  return useMutation({
    mutationFn: async (
      { requestId, staffId }: { requestId: string; staffId: string },
      mutationContext,
    ) => {
      return generated.mutationFn!(
        {
          path: { id: requestId },
          body: { staffId },
        },
        mutationContext,
      )
    },
    meta: {
      skipToast: true,
      invalidatesQuery: appointmentRequestsInvalidationKeys(),
    },
  })
}

export function useRejectAppointmentRequestMutation() {
  const generated = postApiV1AppointmentRequestsByIdRejectMutation()

  return useMutation({
    mutationFn: async (
      { requestId, reason }: { requestId: string; reason?: string },
      mutationContext,
    ) => {
      return generated.mutationFn!(
        {
          path: { id: requestId },
          body: reason?.trim() ? { reason: reason.trim() } : {},
        },
        mutationContext,
      )
    },
    meta: {
      skipToast: true,
      invalidatesQuery: appointmentRequestsInvalidationKeys(),
    },
  })
}

export function useCancelAppointmentRequestMutation() {
  const generated = postApiV1AppointmentRequestsByIdCancelMutation()

  return useMutation({
    mutationFn: async (
      { requestId, closureNote }: { requestId: string; closureNote?: string },
      mutationContext,
    ) =>
      generated.mutationFn!(
        {
          path: { id: requestId },
          body: closureNote?.trim() ? { closureNote: closureNote.trim() } : {},
        },
        mutationContext,
      ),
    meta: {
      skipToast: true,
      invalidatesQuery: appointmentRequestsInvalidationKeys(),
    },
  })
}
