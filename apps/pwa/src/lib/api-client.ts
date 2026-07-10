import { createApiClient, createAuthApi } from '@repo/api-client'

import { env } from '#/env'
import { getPersistedActiveSalonId } from '#/lib/active-salon'

const SALON_CONTEXT_HEADER = 'X-Saluna-Salon-Id'

function withSalonContextHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  const salonId = getPersistedActiveSalonId()
  if (!salonId) return headers
  return {
    ...headers,
    [SALON_CONTEXT_HEADER]: salonId,
  }
}

const baseClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
})

/** Legacy API client that attaches the staff active-salon header when set. */
export const apiClient = {
  baseUrl: baseClient.baseUrl,
  request: <T = unknown>(
    path: string,
    opts: Parameters<typeof baseClient.request>[1] = {},
  ) =>
    baseClient.request<T>(path, {
      ...opts,
      headers: withSalonContextHeaders(opts.headers),
    }),
}

export const api = {
  auth: createAuthApi(apiClient),
}

export type Api = typeof api
