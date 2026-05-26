import {
  createApiClient,
  createAuthApi,
  createClientsApi,
  createDashboardApi,
  createRetentionApi,
} from '@repo/api-client'

import { env } from '#/env'

export const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
})

export const api = {
  auth: createAuthApi(apiClient),
  clients: createClientsApi(apiClient),
  dashboard: createDashboardApi(apiClient),
  retention: createRetentionApi(apiClient),
}

export type Api = typeof api
