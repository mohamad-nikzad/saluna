import { queryOptions, useMutation } from '@tanstack/react-query'
import { getApiV1AppointmentRequests } from '@repo/api-client/sdk'
import {
  getApiV1AppointmentRequestsQueryKey,
  postApiV1AppointmentRequestsByIdApproveMutation,
  postApiV1AppointmentRequestsByIdRejectMutation,
} from '@repo/api-client/query'
import type {
  AppointmentRequestListItem,
  AppointmentRequestStatus,
  AppointmentRequestsListResponse,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1AppointmentRequestsQueryKey }
export type {
  AppointmentRequestListItem,
  AppointmentRequestStatus,
  AppointmentRequestsListResponse,
}

export function appointmentRequestsInvalidationKeys() {
  return [[{ _id: 'getApiV1AppointmentRequests' }]] as const
}

export function appointmentRequestsListQueryOptions(
  status: AppointmentRequestStatus,
) {
  return queryOptions({
    queryKey: getApiV1AppointmentRequestsQueryKey({ query: { status } }),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<AppointmentRequestsListResponse> => {
      const { data } = await getApiV1AppointmentRequests({
        query: { status },
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function pendingAppointmentRequestsQueryOptions() {
  return appointmentRequestsListQueryOptions('pending')
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
          ...(reason?.trim() ? { body: { reason: reason.trim() } } : {}),
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
