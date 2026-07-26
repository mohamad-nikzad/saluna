import { queryOptions, useMutation } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import type { BusinessSettingsPayload } from '@repo/salon-core/forms/settings'
import type { BusinessHours } from '@repo/salon-core/types'
import { getApiV1SettingsBusiness } from '@repo/api-client/sdk'
import {
  getApiV1SettingsBusinessQueryKey,
  patchApiV1SettingsBusinessMutation,
} from '@repo/api-client/query'
import type { BusinessHours as GeneratedBusinessHours } from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'
import { apiClient } from '#/lib/api-client'

export { getApiV1SettingsBusinessQueryKey }

function mapBusinessHours(settings: GeneratedBusinessHours): BusinessHours {
  return settings as unknown as BusinessHours
}

export function businessSettingsQueryOptions() {
  return queryOptions({
    queryKey: getApiV1SettingsBusinessQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<BusinessHours> => {
      const { data } = await getApiV1SettingsBusiness({
        signal,
        throwOnError: true,
      })
      return mapBusinessHours(data.settings)
    },
  })
}

export function useUpdateBusinessSettingsMutation(options?: {
  skipToast?: boolean
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}) {
  const generated = patchApiV1SettingsBusinessMutation()

  return useMutation({
    mutationFn: async (
      values: BusinessSettingsPayload,
      mutationContext,
    ): Promise<BusinessHours> => {
      const response = await generated.mutationFn!(
        { body: values },
        mutationContext,
      )
      return mapBusinessHours(response.settings)
    },
    meta: {
      errorMessage: 'ذخیره ساعات کاری انجام نشد',
      invalidatesQuery:
        options?.invalidatesQuery ?? getApiV1SettingsBusinessQueryKey(),
      ...(options?.skipToast ? { skipToast: true } : {}),
    },
  })
}

export type ClosureWarning = {
  appointmentCount: number
  appointmentsByDate: Array<{ date: string; count: number }>
}

export function salonClosuresQueryOptions() {
  return queryOptions({
    queryKey: ['settings', 'closures'],
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: ({ signal }) =>
      apiClient
        .request<{ closures: string[] }>('/api/v1/settings/closures', {
          signal,
        })
        .then((result) => result.closures),
  })
}

export function useCloseSalonDatesMutation() {
  return useMutation({
    mutationFn: (input: {
      startDate: string
      endDate: string
      confirmed?: boolean
    }) =>
      apiClient.request<{ dates: string[] }>('/api/v1/settings/closures', {
        method: 'POST',
        body: input,
      }),
    meta: {
      errorMessage: 'بستن روزها انجام نشد',
      invalidatesQuery: ['settings', 'closures'],
      skipErrorToast: true,
    },
  })
}

export function useReopenSalonDatesMutation() {
  return useMutation({
    mutationFn: (input: { startDate: string; endDate: string }) =>
      apiClient.request<{ dates: string[] }>('/api/v1/settings/closures', {
        method: 'DELETE',
        body: input,
      }),
    meta: {
      errorMessage: 'باز کردن روز انجام نشد',
      invalidatesQuery: ['settings', 'closures'],
    },
  })
}
