import { queryOptions, useMutation } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { getApiV1MessagingAccounts } from '@repo/api-client/sdk'
import {
  deleteApiV1MessagingAccountsByIdMutation,
  getApiV1MessagingAccountsQueryKey,
  patchApiV1MessagingAccountsByIdMutation,
  postApiV1MessagingLinkMutation,
} from '@repo/api-client/query'
import type {
  CreateMessagingLinkResponse,
  ListMessagingAccountsResponse,
  MessagingAccount,
  MessagingProviderId,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1MessagingAccountsQueryKey }
export type {
  CreateMessagingLinkResponse,
  ListMessagingAccountsResponse,
  MessagingAccount,
  MessagingProviderId,
}

export function messagingAccountsQueryOptions() {
  return queryOptions({
    queryKey: getApiV1MessagingAccountsQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ListMessagingAccountsResponse> => {
      const { data } = await getApiV1MessagingAccounts({
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function useCreateMessagingLinkMutation(options?: {
  skipErrorToast?: boolean
  skipSuccessToast?: boolean
  errorMessage?: string
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}) {
  const generated = postApiV1MessagingLinkMutation()

  return useMutation({
    mutationFn: async (
      provider: MessagingProviderId,
      mutationContext,
    ): Promise<CreateMessagingLinkResponse> => {
      return generated.mutationFn!({ body: { provider } }, mutationContext)
    },
    meta: {
      skipSuccessToast: options?.skipSuccessToast ?? true,
      skipErrorToast: options?.skipErrorToast ?? false,
      errorMessage: options?.errorMessage ?? 'اتصال پیام‌رسان انجام نشد',
      ...(options?.invalidatesQuery
        ? { invalidatesQuery: options.invalidatesQuery }
        : {}),
    },
  })
}

export function usePatchMessagingAccountMutation(options?: {
  skipSuccessToast?: boolean
  errorMessage?: string
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}) {
  const generated = patchApiV1MessagingAccountsByIdMutation()

  return useMutation({
    mutationFn: async (
      { id, enabled }: { id: string; enabled: boolean },
      mutationContext,
    ) => {
      return generated.mutationFn!(
        {
          path: { id },
          body: { enabled },
        },
        mutationContext,
      )
    },
    meta: {
      skipSuccessToast: options?.skipSuccessToast ?? true,
      errorMessage: options?.errorMessage ?? 'تغییر وضعیت پیام‌رسان انجام نشد',
      invalidatesQuery:
        options?.invalidatesQuery ?? getApiV1MessagingAccountsQueryKey(),
    },
  })
}

export function useDeleteMessagingAccountMutation(options?: {
  successMessage?: string
  errorMessage?: string
  invalidatesQuery?: QueryKey | readonly QueryKey[]
}) {
  const generated = deleteApiV1MessagingAccountsByIdMutation()

  return useMutation({
    mutationFn: async (id: string, mutationContext) => {
      return generated.mutationFn!({ path: { id } }, mutationContext)
    },
    meta: {
      successMessage: options?.successMessage ?? 'اتصال پیام‌رسان قطع شد',
      errorMessage: options?.errorMessage ?? 'قطع اتصال پیام‌رسان انجام نشد',
      invalidatesQuery:
        options?.invalidatesQuery ?? getApiV1MessagingAccountsQueryKey(),
    },
  })
}
