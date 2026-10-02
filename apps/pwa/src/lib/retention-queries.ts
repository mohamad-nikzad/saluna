import { queryOptions, useMutation } from '@tanstack/react-query'
import { getApiV1Retention } from '@repo/api-client/sdk'
import {
  getApiV1RetentionQueryKey,
  patchApiV1RetentionByIdMutation,
  postApiV1RetentionByIdBaleMessageMutation,
  postApiV1RetentionByIdSmsMessageMutation,
} from '@repo/api-client/query'
import type {
  FollowUpStatus,
  RetentionItem,
  RetentionListResponse,
  RetentionBaleMessageResponse,
  RetentionSmsMessageResponse,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1RetentionQueryKey }
export type {
  FollowUpStatus,
  RetentionItem,
  RetentionListResponse,
  RetentionBaleMessageResponse,
  RetentionSmsMessageResponse,
}

export function retentionInvalidationKeys() {
  return [[{ _id: 'getApiV1Retention' }]] as const
}

export function retentionListQueryOptions() {
  return queryOptions({
    queryKey: getApiV1RetentionQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<RetentionListResponse> => {
      const { data } = await getApiV1Retention({
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function useUpdateRetentionStatusMutation() {
  const generated = patchApiV1RetentionByIdMutation()

  return useMutation({
    mutationFn: async (
      { id, status }: { id: string; status: FollowUpStatus },
      mutationContext,
    ) => {
      return generated.mutationFn!(
        {
          path: { id },
          body: { status },
        },
        mutationContext,
      )
    },
    meta: {
      skipToast: true,
      invalidatesQuery: retentionInvalidationKeys(),
    },
  })
}

export function useSendRetentionBaleMessageMutation() {
  const generated = postApiV1RetentionByIdBaleMessageMutation()

  return useMutation({
    mutationFn: async (
      { id, retry, message }: { id: string; retry?: boolean; message?: string },
      mutationContext,
    ): Promise<RetentionBaleMessageResponse> => {
      return generated.mutationFn!(
        {
          path: { id },
          ...(retry || message
            ? { body: { ...(retry ? { retry: true } : {}), message } }
            : {}),
        },
        mutationContext,
      )
    },
    meta: {
      skipToast: true,
      invalidatesQuery: retentionInvalidationKeys(),
    },
  })
}

export function useSendRetentionSmsMessageMutation() {
  const generated = postApiV1RetentionByIdSmsMessageMutation()

  return useMutation({
    mutationFn: async (
      { id, message, retry }: { id: string; message: string; retry?: boolean },
      mutationContext,
    ): Promise<RetentionSmsMessageResponse> => {
      return generated.mutationFn!(
        {
          path: { id },
          body: { message, ...(retry ? { retry: true } : {}) },
        },
        mutationContext,
      )
    },
    meta: {
      skipToast: true,
      invalidatesQuery: retentionInvalidationKeys(),
    },
  })
}
