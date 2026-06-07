# @repo/api-client

Shared API client for Saluna apps. The **generated** SDK, types, and TanStack Query options are the primary surface. A small **legacy auth** client remains for Better Auth passthrough until OpenAPI wrappers exist.

## Package layout

```txt
packages/api-client/src/
  legacy/          # auth-only hand-written client
    auth.ts
    client.ts
    endpoints.ts
    errors.ts
  generated/       # HeyAPI output — do not edit
  client.ts        # configureGeneratedApiClient() — exported via ./generated-client only
  errors.ts        # stable ApiError / NetworkError re-export
  react/           # shared domain hooks scaffold
  index.ts         # errors + legacy auth exports
```

| Directory | Owner | Rule |
|-----------|-------|------|
| `src/legacy/` | Manual | Auth-only `createApiClient()` + `createAuthApi()`. Removed for all other domains in Phase 20. |
| `src/generated/` | HeyAPI | Regenerated from `packages/api-contract/openapi.json`. **Do not edit manually.** |

HeyAPI clears `src/generated/` on each run, so do not add hand-maintained files there.

## Entrypoints

| Import | Purpose |
|--------|---------|
| `@repo/api-client` | `ApiError` / `NetworkError` + legacy auth (`createApiClient`, `createAuthApi`) |
| `@repo/api-client/legacy` | Explicit legacy auth access |
| `@repo/api-client/auth` | Auth factory and types only |
| `@repo/api-client/generated-client` | Generated client setup (`configureGeneratedApiClient`) |
| `@repo/api-client/sdk` | Generated non-React SDK (server, scripts) |
| `@repo/api-client/query` | Generated TanStack Query options |
| `@repo/api-client/types` | Generated API DTOs (request/response, params) |
| `@repo/api-client/react` | Shared domain hooks scaffold |
| `@repo/api-client/errors` | Stable `ApiError` / `NetworkError` contract |

---

## Generated client setup

Configure the generated client once at app startup. Keep app-specific auth stores outside this package.

```ts
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'

configureGeneratedApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',              // web cookie auth
  getAccessToken: () => getToken(),  // optional bearer provider
})
```

Options:

- `baseUrl` — required; trailing slashes are trimmed
- `getAccessToken` — optional callback; sets `Authorization: Bearer …` when a token is returned
- `credentials` — passed through to `fetch` (e.g. `'include'` for cookie sessions, `'omit'` for bearer-only)

Generated calls throw `ApiError` (HTTP failures) or `NetworkError` (connectivity/fetch failures).

**Do not** import `configureGeneratedApiClient` from `@repo/api-client`. Use `@repo/api-client/generated-client` to avoid ambiguity with legacy `createApiClient()`.

---

## Generated SDK

Use for non-React contexts (Astro server, scripts, one-off calls).

```ts
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'
import { getApiV1Clients, getApiV1ClientsById } from '@repo/api-client/sdk'

configureGeneratedApiClient({ baseUrl: env.apiBaseUrl, credentials: 'include' })

const { data } = await getApiV1Clients({ throwOnError: true })
```

SDK functions are named after OpenAPI operation IDs (e.g. `getApiV1Clients`, `patchApiV1ClientsById`).

---

## Generated query options

Prefer generated query/mutation options directly in React apps. **Do not** add one wrapper hook per endpoint unless the hook adds shared domain behavior (staleTime, invalidation, composition).

```ts
import { getApiV1ClientsByIdOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'

const query = useQuery({
  ...getApiV1ClientsByIdOptions({ path: { id } }),
  enabled: !!id,
})
```

Each operation exports `*Options`, `*QueryKey`, and (for writes) `*Mutation` helpers. Call `configureGeneratedApiClient()` before any query or SDK usage.

### React layer (`@repo/api-client/react`)

Add hooks here only when multiple apps need the same domain behavior. Otherwise compose `useQuery` / `useMutation` with generated options in the app.

---

## Legacy auth API

Better Auth passthrough routes are not yet OpenAPI-documented. Apps use the hand-written auth client for login, signup, session, and logout.

```ts
import { createApiClient, createAuthApi } from '@repo/api-client'

const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include', // web: cookie session
  getToken: () => token,  // optional bearer (native)
})

const auth = createAuthApi(apiClient)
const { user } = await auth.me()
```

PWA wiring (`apps/pwa/src/lib/api-client.ts`): one `createApiClient()` instance and `createAuthApi()` for `api.auth` only. All other domains use generated SDK/query options.

---

## Type strategy

| Source | Use for |
|--------|---------|
| `@repo/salon-core` | Domain models, business logic, forms, validation |
| `@repo/api-client/types` | API request/response DTOs, path params, query params |

Use generated DTO types at the API boundary. Add mappers only when generated DTOs differ from domain types.

---

## Error contract

```ts
import { ApiError, NetworkError } from '@repo/api-client/errors'
```

| Class | When |
|-------|------|
| `ApiError` | HTTP response with non-2xx status. `status`, `message`, `payload`. |
| `NetworkError` | Fetch/connectivity failure. `cause` holds the underlying error. |

Legacy and generated clients both normalize to these classes.

---

## Generation commands

Regenerate in order when API routes change:

```bash
# 1. OpenAPI contract from Hono route definitions
pnpm generate:api-contract

# 2. HeyAPI client from the contract
pnpm generate:api-client
```

| Command | Runs | Output |
|---------|------|--------|
| `pnpm generate:api-contract` | `apps/api` OpenAPI script | `packages/api-contract/openapi.json` |
| `pnpm generate:api-client` | `openapi-ts` in this package | `packages/api-client/src/generated/` |

```txt
Hono OpenAPI routes (apps/api)
  → packages/api-contract/openapi.json
  → packages/api-client/src/generated/   (sdk, query, types)
```

---

## Quick reference

```ts
// Legacy auth (Better Auth passthrough)
import { createApiClient, createAuthApi } from '@repo/api-client'

// Generated setup
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'

// Generated usage
import { getApiV1Clients } from '@repo/api-client/sdk'
import { getApiV1ClientsOptions } from '@repo/api-client/query'
import type { Client } from '@repo/api-client/types'

// Shared errors
import { ApiError, NetworkError } from '@repo/api-client/errors'
```
