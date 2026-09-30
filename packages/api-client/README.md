# @repo/api-client

Saluna apps use the generated SDK, types, and TanStack Query options for API
requests. A manual auth client remains for Better Auth passthrough.

## Imports

| Import                              | Purpose                                   |
| ----------------------------------- | ----------------------------------------- |
| `@repo/api-client`                  | Shared errors and manual auth factories   |
| `@repo/api-client/auth`             | Auth factory and types                    |
| `@repo/api-client/legacy`           | Explicit access to the manual auth client |
| `@repo/api-client/generated-client` | `configureGeneratedApiClient`             |
| `@repo/api-client/sdk`              | Generated SDK                             |
| `@repo/api-client/query`            | Generated TanStack Query options          |
| `@repo/api-client/types`            | Generated request and response types      |
| `@repo/api-client/errors`           | `ApiError` and `NetworkError`             |

## Configure the generated client

Configure it once at app startup. Keep auth state in the app.

```ts
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'

configureGeneratedApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
  getSalonId: () => activeSalonId,
})
```

`baseUrl` is required; the client trims trailing slashes. `credentials` passes
through to fetch. The optional `getAccessToken` callback adds a Bearer header.
The optional `getSalonId` callback adds `X-Saluna-Salon-Id` for staff requests
scoped to the selected Salon. Both callbacks may return a promise.

## SDK calls

Use the SDK in Astro server code, scripts, and direct calls:

```ts
import { getApiV1Clients } from '@repo/api-client/sdk'

const { data } = await getApiV1Clients({ throwOnError: true })
```

Function names follow OpenAPI operation IDs.

## React queries

Compose generated options with TanStack Query in the app:

```ts
import { getApiV1ClientsByIdOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'

const query = useQuery({
  ...getApiV1ClientsByIdOptions({ path: { id } }),
  enabled: !!id,
})
```

Operations export query options, query keys, and mutation helpers. Add a wrapper
hook only when it shares domain behavior such as invalidation or composition.

## Auth

Login, signup, session, and logout use the manual auth client:

```ts
import { createApiClient, createAuthApi } from '@repo/api-client'

const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  credentials: 'include',
})
const auth = createAuthApi(apiClient)
const { user } = await auth.me()
```

The PWA configures it in
[api-client.ts](../../apps/pwa/src/lib/api-client.ts). Other domains use the
generated client.

## Types and errors

Use `@repo/salon-core` for domain models, forms, validation, and business logic.
Use `@repo/api-client/types` for API request and response types.

Both clients normalize HTTP failures to `ApiError`, with `status`, `message`,
and `payload`. Fetch failures become `NetworkError`, with the original
`cause`.

## Regenerate

```bash
pnpm generate:api-contract
pnpm generate:api-client
```

HeyAPI clears `src/generated/` before writing output from
`packages/api-contract/openapi.json`. Keep manual code outside that directory.
See [contract generation](../api-contract/README.md).
