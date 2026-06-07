import { createApiClient, createAuthApi } from '@repo/api-client'

import { env } from '#/env'

export const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
})

export const api = {
  auth: createAuthApi(apiClient),
}

export type Api = typeof api
