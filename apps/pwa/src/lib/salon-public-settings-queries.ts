import { queryOptions, useMutation } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import type { PublicSettingsInput } from '@repo/salon-core/forms/public'
import type { PublicSettingsUpdateRequest } from '@repo/api-client/types'
import {
  getApiV1SalonPublicSettings,
} from '@repo/api-client/sdk'
import {
  getApiV1SalonPublicSettingsQueryKey,
  patchApiV1SalonPublicSettingsSlugMutation,
  putApiV1SalonPublicSettingsMutation,
} from '@repo/api-client/query'
import type { ManagerPublicSettingsResult } from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1SalonPublicSettingsQueryKey }
export type { ManagerPublicSettingsResult }

export function salonPublicSettingsQueryOptions() {
  return queryOptions({
    queryKey: getApiV1SalonPublicSettingsQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ManagerPublicSettingsResult> => {
      const { data } = await getApiV1SalonPublicSettings({
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function useUpdateSalonPublicSettingsMutation(
  options?: {
    skipToast?: boolean
    invalidatesQuery?: QueryKey | readonly QueryKey[]
  },
) {
  const generated = putApiV1SalonPublicSettingsMutation()

  return useMutation({
    mutationFn: async (
      body: PublicSettingsInput,
      mutationContext,
    ): Promise<ManagerPublicSettingsResult> => {
      return generated.mutationFn!(
        { body: body as PublicSettingsUpdateRequest },
        mutationContext,
      )
    },
    meta: {
      errorMessage: 'ذخیره تنظیمات انجام نشد',
      invalidatesQuery:
        options?.invalidatesQuery ?? getApiV1SalonPublicSettingsQueryKey(),
      ...(options?.skipToast ? { skipToast: true } : {}),
    },
  })
}

export function useUpdateSalonSlugMutation() {
  const generated = patchApiV1SalonPublicSettingsSlugMutation()

  return useMutation({
    mutationFn: async (
      slug: string,
      mutationContext,
    ): Promise<ManagerPublicSettingsResult> => {
      return generated.mutationFn!(
        { body: { slug } },
        mutationContext,
      )
    },
    meta: {
      skipToast: true,
      invalidatesQuery: getApiV1SalonPublicSettingsQueryKey(),
    },
  })
}
