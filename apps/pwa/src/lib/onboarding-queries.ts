import { queryOptions, useMutation } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { getApiV1Onboarding } from '@repo/api-client/sdk'
import {
  getApiV1OnboardingQueryKey,
  patchApiV1OnboardingMutation,
} from '@repo/api-client/query'
import type {
  OnboardingAction,
  OnboardingResponse,
  OnboardingStatus,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1OnboardingQueryKey }
export type { OnboardingAction, OnboardingResponse, OnboardingStatus }

export function onboardingInvalidationKeys() {
  return [[{ _id: 'getApiV1Onboarding' }]] as const
}

export function onboardingQueryOptions() {
  return queryOptions({
    queryKey: getApiV1OnboardingQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<OnboardingResponse> => {
      const { data } = await getApiV1Onboarding({
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

type UpdateOnboardingMutationOptions = {
  skipToast?: boolean
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}

export function useUpdateOnboardingMutation(
  options: UpdateOnboardingMutationOptions = {},
) {
  const generated = patchApiV1OnboardingMutation()

  return useMutation({
    mutationFn: async (
      action: OnboardingAction,
      mutationContext,
    ): Promise<OnboardingResponse> => {
      return generated.mutationFn!({ body: { action } }, mutationContext)
    },
    meta: {
      ...(options.skipToast ? { skipToast: true } : {}),
      ...(options.invalidatesQuery
        ? { invalidatesQuery: options.invalidatesQuery }
        : {}),
    },
  })
}
