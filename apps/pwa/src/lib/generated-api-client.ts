import { configureGeneratedApiClient } from '@repo/api-client/generated-client'

import { env } from '#/env'

configureGeneratedApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
})

/**
 * Dual-run during API client migration:
 * - Legacy `api.auth` from `#/lib/api-client` stays until auth has OpenAPI wrappers.
 * - Generated query/mutation options from `@repo/api-client/query` require this module
 *   to be imported at app startup (see `main.tsx`).
 */
