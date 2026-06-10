import { queryOptions, useMutation } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { getApiV1NotificationPreferences } from '@repo/api-client/sdk'
import {
  getApiV1NotificationPreferencesQueryKey,
  patchApiV1NotificationPreferencesMutation,
} from '@repo/api-client/query'
import type {
  NotificationPreferences,
  NotificationPreferencesResponse,
  UpdateNotificationPreferencesRequest,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1NotificationPreferencesQueryKey }
export type {
  NotificationPreferences,
  NotificationPreferencesResponse,
  UpdateNotificationPreferencesRequest,
}

export function notificationPreferencesQueryOptions() {
  return queryOptions({
    queryKey: getApiV1NotificationPreferencesQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<NotificationPreferencesResponse> => {
      const { data } = await getApiV1NotificationPreferences({
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function useUpdateNotificationPreferencesMutation(options?: {
  skipSuccessToast?: boolean
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}) {
  const generated = patchApiV1NotificationPreferencesMutation()

  return useMutation({
    mutationFn: async (
      body: UpdateNotificationPreferencesRequest,
      mutationContext,
    ): Promise<NotificationPreferencesResponse> => {
      return generated.mutationFn!({ body }, mutationContext)
    },
    meta: {
      skipSuccessToast: options?.skipSuccessToast ?? true,
      invalidatesQuery:
        options?.invalidatesQuery ?? getApiV1NotificationPreferencesQueryKey(),
    },
  })
}
