# @repo/api-client

Shared API client for Saluna apps. During Phases 1–6 the root export remains the **legacy** hand-written client. Generated SDK, types, and TanStack Query options live beside it and are ready for app migration (Phase 7, deferred).

## Package layout

```txt
packages/api-client/src/
  legacy/          # hand-written client — edit here
  generated/       # HeyAPI output — do not edit
  client.ts        # configureGeneratedApiClient() — exported via ./generated-client only
  errors.ts        # stable ApiError / NetworkError re-export
  react/           # future shared domain hooks (empty scaffold)
  index.ts         # re-exports legacy barrel only
```

| Directory | Owner | Rule |
|-----------|-------|------|
| `src/legacy/` | Manual | Existing `createApiClient()` + `createXApi()` factories. Behavior unchanged during migration. |
| `src/generated/` | HeyAPI | Regenerated from `packages/api-contract/openapi.json`. **Do not edit manually.** |

HeyAPI clears `src/generated/` on each run, so do not add hand-maintained files there. Generated-folder rules live in this README.

## Entrypoints

| Import | Purpose |
|--------|---------|
| `@repo/api-client` | Legacy public API (`createApiClient`, `createXApi`, etc.) — **unchanged** during Phases 1–6 |
| `@repo/api-client/legacy` | Explicit legacy access during migration |
| `@repo/api-client/generated-client` | Generated client setup (`configureGeneratedApiClient`) — **not** on the root barrel |
| `@repo/api-client/sdk` | Generated non-React SDK (server, scripts) |
| `@repo/api-client/query` | Generated TanStack Query options |
| `@repo/api-client/types` | Generated API DTOs (request/response, params) |
| `@repo/api-client/react` | Future shared domain hooks — empty scaffold for now |
| `@repo/api-client/errors` | Stable `ApiError` / `NetworkError` contract |

Legacy subpath exports (`./auth`, `./clients`, `./staff`, etc.) point at `src/legacy/*` and remain available even if apps currently import only the root barrel.

---

## Legacy API

Apps continue to use the hand-written client with no import changes.

```ts
import {
  createApiClient,
  createClientsApi,
  createAuthApi,
} from '@repo/api-client'

// Or explicitly:
import { createApiClient } from '@repo/api-client/legacy'

const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include', // web: cookie session
  getToken: () => token,  // optional bearer (native)
})

const clients = createClientsApi(apiClient)
const me = await clients.list()
```

PWA wiring today (`apps/pwa/src/lib/api-client.ts`): one `createApiClient()` instance, then `createXApi()` factories composed into a local `api` object.

**Do not** import `configureGeneratedApiClient` from `@repo/api-client`. Use `@repo/api-client/generated-client` instead to avoid ambiguity with legacy `createApiClient()`.

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

Generated calls throw `ApiError` (HTTP failures) or `NetworkError` (connectivity/fetch failures), matching the legacy client contract.

---

## Generated SDK

Use for non-React contexts (Astro server, scripts, one-off calls).

```ts
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'
import { getApiV1Clients, getApiV1ClientsById } from '@repo/api-client/sdk'

configureGeneratedApiClient({ baseUrl: env.apiBaseUrl, credentials: 'include' })

const { data } = await getApiV1Clients({ throwOnError: true })

const { data: client } = await getApiV1ClientsById({
  path: { id: clientId },
  throwOnError: true,
})
```

SDK functions are named after OpenAPI operation IDs (e.g. `getApiV1Clients`, `patchApiV1ClientsById`). Scope today: **clients** route group only; more groups will appear as OpenAPI coverage expands.

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

Mutations:

```ts
import { postApiV1ClientsMutation } from '@repo/api-client/query'
import { useMutation } from '@tanstack/react-query'

const createClient = useMutation(postApiV1ClientsMutation())
```

Each operation exports `*Options`, `*QueryKey`, and (for writes) `*Mutation` helpers. Call `configureGeneratedApiClient()` before any query or SDK usage.

### React layer (`@repo/api-client/react`)

Empty scaffold for Phase 5. Add hooks here only when multiple apps need the same domain behavior. Otherwise compose `useQuery` / `useMutation` with generated options in the app.

---

## Type strategy

Two type sources coexist during migration:

| Source | Use for |
|--------|---------|
| `@repo/salon-core` | Domain models, business logic, forms, validation, shared app concepts |
| `@repo/api-client/types` | API request/response DTOs, path params, query params, error DTOs |

Per migrated slice (Phase 7, later):

1. Use generated DTO types at the API boundary.
2. Keep salon-core types inside domain/business logic.
3. Add mapper functions only when generated DTOs differ from domain types.
4. Remove hand-written API DTOs only for that migrated slice.
5. No repo-wide type replacement.

Example generated types: `Client`, `ClientCreateRequest`, `ClientsListResponse` from `@repo/api-client/types`.

---

## Error contract

Import from `@repo/api-client/errors` (or catch errors thrown by either client):

```ts
import { ApiError, NetworkError } from '@repo/api-client/errors'
```

| Class | When |
|-------|------|
| `ApiError` | HTTP response with non-2xx status. `status`, `message`, `payload`. |
| `NetworkError` | Fetch/connectivity failure. `cause` holds the underlying error. |

Legacy and generated clients both normalize to these classes. Generated config applies error interceptors automatically.

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

Package-local shortcuts:

```bash
pnpm --filter @repo/api generate:openapi   # contract only
pnpm --filter @repo/api-client generate     # client only
```

See also `packages/api-contract/README.md` for contract scope and source-of-truth flow.

```txt
Hono OpenAPI routes (apps/api)
  → packages/api-contract/openapi.json
  → packages/api-client/src/generated/   (sdk, query, types)
```

---

## Migration rules (Phases 1–6)

- Root `@repo/api-client` exports **legacy only**. No app migration yet (Phase 7 deferred).
- Do not edit `src/generated/` manually. Regenerate with `pnpm generate:api-client`.
- Do not merge legacy `createApiClient()` and generated `configureGeneratedApiClient()` into one API.
- Keep app-specific auth configuration in apps, not in this package.
- Prefer generated query options over per-endpoint wrapper hooks.
- `@repo/data-client` was removed in Phase 17; PWA is online-only.

### Deferred (not Phases 1–6)

- **Phase 7:** Migrate apps by vertical slice (query + mutation + invalidation + auth per slice).
- **OpenAPI expansion:** public booking, push, messaging webhooks, health, Better Auth passthrough.

---

## Quick reference

```ts
// Legacy (current apps)
import { createApiClient } from '@repo/api-client'

// Generated setup (separate entrypoint)
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'

// Generated usage
import { getApiV1Clients } from '@repo/api-client/sdk'
import { getApiV1ClientsOptions } from '@repo/api-client/query'
import type { Client } from '@repo/api-client/types'

// Shared errors
import { ApiError, NetworkError } from '@repo/api-client/errors'
```
