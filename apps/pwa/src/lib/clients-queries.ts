import { queryOptions, useMutation } from '@tanstack/react-query'
import type { ClientFormInput } from '@repo/salon-core/forms/client'
import type { Client, ClientSummary } from '@repo/salon-core/types'
import {
  getApiV1ClientsByIdSummary,
  getApiV1Clients,
} from '@repo/api-client/sdk'
import {
  getApiV1ClientsByIdSummaryQueryKey,
  getApiV1ClientsQueryKey,
  patchApiV1ClientsByIdMutation,
  postApiV1ClientsBulkMutation,
  postApiV1ClientsMutation,
} from '@repo/api-client/query'
import type {
  Client as GeneratedClient,
  ClientBulkCreateResponse,
  ClientSummary as GeneratedClientSummary,
} from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1ClientsQueryKey, getApiV1ClientsByIdSummaryQueryKey }

/** JSON DTOs are structurally compatible; salon-core uses Date where API returns ISO strings. */
function mapClient(client: GeneratedClient): Client {
  return client as unknown as Client
}

function mapClientSummary(summary: GeneratedClientSummary): ClientSummary {
  return summary as unknown as ClientSummary
}

export function clientsListQueryOptions() {
  return queryOptions({
    queryKey: getApiV1ClientsQueryKey(),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<Client[]> => {
      const { data } = await getApiV1Clients({ signal, throwOnError: true })
      return data.clients.map(mapClient)
    },
  })
}

export function clientSummaryQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: getApiV1ClientsByIdSummaryQueryKey({ path: { id: clientId } }),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<ClientSummary> => {
      const { data } = await getApiV1ClientsByIdSummary({
        path: { id: clientId },
        signal,
        throwOnError: true,
      })
      return mapClientSummary(data)
    },
  })
}

function toClientBody(values: ClientFormInput) {
  return {
    name: values.name,
    phone: values.phone,
    notes: values.notes,
    tags: values.tags,
  }
}

export function useCreateClientMutation() {
  const generated = postApiV1ClientsMutation()

  return useMutation<Client, unknown, ClientFormInput>({
    mutationFn: async (values, mutationContext) => {
      const response = await generated.mutationFn!(
        { body: toClientBody(values) },
        mutationContext,
      )
      return mapClient(response.client)
    },
    meta: {
      errorMessage: 'ذخیره مشتری انجام نشد',
      invalidatesQuery: getApiV1ClientsQueryKey(),
    },
  })
}

export function useBulkCreateClientsMutation() {
  const generated = postApiV1ClientsBulkMutation()

  return useMutation<
    ClientBulkCreateResponse,
    unknown,
    Array<{ name: string; phone: string }>
  >({
    mutationFn: async (clients, mutationContext) => {
      return generated.mutationFn!({ body: { clients } }, mutationContext)
    },
    meta: {
      skipToast: true,
      invalidatesQuery: getApiV1ClientsQueryKey(),
      errorMessage: 'افزودن گروهی مشتریان انجام نشد',
    },
  })
}

export function useUpdateClientMutation(clientId: string) {
  const generated = patchApiV1ClientsByIdMutation()

  return useMutation<Client, unknown, ClientFormInput>({
    mutationFn: async (values, mutationContext) => {
      const response = await generated.mutationFn!(
        {
          path: { id: clientId },
          body: toClientBody(values),
        },
        mutationContext,
      )
      return mapClient(response.client)
    },
    meta: {
      errorMessage: 'ذخیره اطلاعات مشتری انجام نشد',
      invalidatesQuery: [
        getApiV1ClientsQueryKey(),
        getApiV1ClientsByIdSummaryQueryKey({ path: { id: clientId } }),
      ],
    },
  })
}
