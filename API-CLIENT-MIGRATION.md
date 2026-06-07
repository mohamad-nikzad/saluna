# API Client Migration Plan

Saluna monorepo — shared `@repo/api-client` migration using HeyAPI-generated SDK, types, and TanStack Query options.

**Status:** Phases 1–6 **complete**. Phases 7–20 below are the app migration execution plan.

**Docs:** `packages/api-client/README.md` (usage) · `packages/api-contract/README.md` (contract generation)

---

## Progress

| Phase | Status | Deliverables |
|-------|--------|--------------|
| 1. Legacy preservation | ✅ Done | `src/legacy/`, root re-exports legacy only, `./errors`, all 13 legacy subpaths |
| 2. OpenAPI contract | ✅ Done | `packages/api-contract/`, clients routes in `apps/api/src/openapi/`, `pnpm generate:api-contract` |
| 3. HeyAPI generated client | ✅ Done | `src/generated/`, `./sdk` / `./query` / `./types`, `pnpm generate:api-client` |
| 4. Generated client config | ✅ Done | `configureGeneratedApiClient()` in `src/client.ts`, exported via `./generated-client`, error normalization + tests |
| 5. React scaffold | ✅ Done | `src/react/index.ts` (empty), `./react` export |
| 6. Documentation | ✅ Done | `packages/api-client/README.md` |
| 7. App foundation | ✅ Done | `generated-api-client.ts` wired at PWA startup; dual-run with legacy |
| 8. Clients (pilot) | ✅ Done | List/detail/CRUD on generated query/mutation options; online-only |
| 9. Staff | ✅ Done | OpenAPI staff routes; PWA staff screens on generated query/mutation options |
| 10. Services catalog | ✅ Done | OpenAPI services/categories/families/addons/catalog-presets; PWA catalog on generated options |
| 11–16. Vertical slices | ⏳ Planned | OpenAPI + app migration per route group (see below) |
| 17. data-client removal | ⏳ Planned | Drop offline layer after CRUD slices proven |
| 18. Web public API | ⏳ Planned | `apps/web` raw fetch → generated SDK |
| 19. Native app | ⏳ Deferred | Not in prod — migrate when scoped |
| 20. Legacy cleanup | ⏳ Planned | Remove `src/legacy/` when no consumers remain |

**Known gaps (non-blocking for Phase 7 start):**

- Root `pnpm typecheck` / `pnpm lint` fail on a pre-existing turbo cyclic dependency (`@repo/auth` ↔ `@repo/database`).
- `packages/api-client` lint reports `@typescript-eslint/no-explicit-any` in generated files; consider eslint ignore for `src/generated/` if needed.

---

## Goals

**Achieved (Phases 1–6):**

- Generated API client lives beside the legacy hand-written client.
- All app behavior preserved — no app import changes.
- OpenAPI contract generated from Hono route definitions (clients route group first).
- Infrastructure and documentation complete (`packages/api-client/README.md`).

**Next (Phases 7–20):**

- Wire generated client in apps; migrate by vertical slice (OpenAPI first, then screens).
- Remove `@repo/data-client` after tenant CRUD is on generated options.
- Retire legacy client when all consumers are migrated.

---

## Core principle

This is a **migration**, not a rewrite.

```txt
Move existing code to legacy first
  → keep apps working
  → add generated client beside it
  → migrate apps last, by vertical slice (later)
```

Phase 1 must change **zero app imports**.

---

## Current codebase (after Phases 1–6)

### `@repo/api-client`

- Location: `packages/api-client/`
- **Legacy (apps today):** `createApiClient()` + `createXApi()` factories under `src/legacy/`; root barrel re-exports legacy only
- **Generated (ready, unused in apps):** HeyAPI output under `src/generated/`; configure via `@repo/api-client/generated-client`
- Apps still wire legacy locally (unchanged imports):
  - PWA: `apps/pwa/src/lib/api-client.ts` (`credentials: 'include'`)
  - Native: `apps/native/lib/api.ts` (`getToken`, `credentials: 'omit'`) — not in prod; out of scope for now
- Package exports legacy subpaths + `./generated-client`, `./sdk`, `./query`, `./types`, `./react`, `./errors`
- Types: domain models from `@repo/salon-core`; API DTOs from `@repo/api-client/types` (generated, clients only so far)

### `@repo/api-contract`

- `packages/api-contract/openapi.json` — generated, not hand-maintained
- Scope: **clients** route group (`/api/v1/clients/*`)
- Source: `apps/api/src/openapi/` (`contract-app.ts`, `routes/clients.ts`, `schemas/clients.ts`)
- Command: `pnpm generate:api-contract`

### `@repo/data-client` (to be removed later)

- PWA manager screens use offline IndexedDB via `createDataClient()` (`apps/pwa/src/lib/manager-data-client.tsx`)
- `useManagerCollection` combines React Query + data-client subscribe/sync
- **Decision:** offline support is going away; data-client will be removed in a separate effort after the generated client is proven on tenant CRUD APIs. Untouched in Phases 1–6.

### Hono API

- Runtime routes: plain Hono + Zod validators (`zValidator` + `@repo/salon-core/forms/*`) — unchanged behavior
- OpenAPI: `@hono/zod-openapi` contract for clients; ~25 other route groups still legacy
- Generation: `apps/api/src/openapi/generate-openapi.ts` → `packages/api-contract/openapi.json`

### Web

- `apps/web/src/lib/public-api.ts` uses raw `fetch`, not `@repo/api-client`
- Public booking API migration is a later pass (Phase 7+)

---

## Target package shape

```txt
packages/
  api-contract/
    openapi.json              # generated by apps/api — not hand-maintained

  api-client/
    src/
      legacy/                   # existing hand-written client (moved here in Phase 1)
        client.ts               # createApiClient()
        errors.ts               # ApiError, NetworkError (legacy copy)
        auth.ts, clients.ts, …
        index.ts
      generated/                # HeyAPI output — do not edit manually (cleared on regen)
        types.gen.ts
        sdk.gen.ts
        @tanstack/react-query.gen.ts
        client.gen.ts, client/, core/   # HeyAPI client runtime (generator-owned)
      errors.ts                 # stable app-facing re-export of ApiError / NetworkError
      client.ts                 # configureGeneratedApiClient() — exported via ./generated-client only
      react/
        index.ts                # empty or minimal in Phase 5 — no domain hooks yet
      index.ts                  # re-exports legacy barrel (unchanged external API)
```

---

## Package exports

### Current exports (legacy + generated; root = legacy only)

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./legacy": "./src/legacy/index.ts",

    "./auth": "./src/legacy/auth.ts",
    "./today": "./src/legacy/today.ts",
    "./dashboard": "./src/legacy/dashboard.ts",
    "./onboarding": "./src/legacy/onboarding.ts",
    "./retention": "./src/legacy/retention.ts",
    "./business-settings": "./src/legacy/business-settings.ts",
    "./salon-public-settings": "./src/legacy/salon-public-settings.ts",
    "./clients": "./src/legacy/clients.ts",
    "./staff": "./src/legacy/staff.ts",
    "./services": "./src/legacy/services.ts",
    "./appointments": "./src/legacy/appointments.ts",
    "./endpoints": "./src/legacy/endpoints.ts",

    "./errors": "./src/errors.ts",
    "./generated-client": "./src/client.ts",
    "./sdk": "./src/generated/sdk.gen.ts",
    "./query": "./src/generated/@tanstack/react-query.gen.ts",
    "./types": "./src/generated/types.gen.ts",
    "./react": "./src/react/index.ts"
  }
}
```

Keep all 13 existing legacy subpath exports even if grep shows apps do not currently import them.

Root `@repo/api-client` re-exports the **legacy barrel only** (until Phase 7 migrates consumers). Apps keep working without import changes.

```ts
// Legacy — unchanged
import { createApiClient } from '@repo/api-client'

// Generated client setup — separate entrypoint (Phase 4+)
import { configureGeneratedApiClient } from '@repo/api-client/generated-client'
```

Do **not** export `configureGeneratedApiClient()` from the root `@repo/api-client` barrel. That would create ambiguity with legacy `createApiClient()`.

### Entrypoint purposes

| Entrypoint | Purpose |
|------------|---------|
| `@repo/api-client` | Legacy public API only (`createApiClient`, `createXApi`, etc.) — unchanged since Phase 1 |
| `@repo/api-client/legacy` | Explicit legacy access during migration |
| `@repo/api-client/generated-client` | Generated client setup only (`configureGeneratedApiClient`). Does not replace legacy `createApiClient()` |
| `@repo/api-client/sdk` | Generated non-React SDK (Astro server, scripts) |
| `@repo/api-client/query` | Generated TanStack Query options |
| `@repo/api-client/types` | Generated API DTOs (request/response, params) |
| `@repo/api-client/react` | Future shared domain hooks only — empty/minimal for now |
| `@repo/api-client/errors` | Stable `ApiError` / `NetworkError` contract |

---

## Architecture decisions

### OpenAPI generation

- Use **`@hono/zod-openapi`** on Hono route definitions.
- Reuse existing Zod schemas from `@repo/salon-core/forms` inside OpenAPI route definitions.
- **Do not** hand-maintain `openapi.json` as source of truth.
- **Do not** generate the full contract only from salon-core forms schemas.

```txt
Hono route definitions + Zod schemas
  → generated packages/api-contract/openapi.json
  → HeyAPI generated client in packages/api-client/src/generated/
```

- Contract output: `packages/api-contract/openapi.json`
- HeyAPI input: `../api-contract/openapi.json` (from `packages/api-client`)

### First OpenAPI pass scope

Start with **one route group: `clients`**.

Then expand incrementally to tenant-facing CRUD/query APIs already represented in `packages/api-client/src/endpoints.ts` or existing api-client modules.

**Exclude from first pass:**

- Better Auth passthrough wildcard `/api/v1/auth/*`
- Public booking (`/api/v1/public/*`)
- Push (`/api/v1/push`)
- Messaging webhooks (`/api/v1/messaging/bale`, `/api/v1/messaging/telegram`)
- Health (`/health`)

**Later passes (after tenant CRUD is proven):**

- Public booking API
- Push API
- Webhook documentation
- Health / internal ops

### Better Auth

- Do not include the Better Auth passthrough `/api/v1/auth/*` in the first OpenAPI contract.
- Keep `packages/api-client/src/legacy/auth.ts` / `createAuthApi` under legacy.
- Only document auth in OpenAPI if Saluna-owned wrapper routes have stable request/response schemas.

### Legacy vs generated client configuration

- **Do not** modify legacy `createApiClient()` behavior.
- Move `createApiClient()` to `src/legacy/client.ts`.
- Root `@repo/api-client` continues to export legacy `createApiClient()` only.
- Add generated config separately: `configureGeneratedApiClient()` or `setupGeneratedApiClient()` in `src/client.ts`.
- Export generated config only via `@repo/api-client/generated-client` — **not** from the root barrel.
- **Do not** merge legacy and generated configuration APIs during initial migration.

### Types

- **`@repo/salon-core`** remains source of truth for domain models, business logic, forms, validation, and shared app concepts.
- **`@repo/api-client/types`** is source of truth for API request/response DTOs, path params, query params, and error DTOs.

Per migrated slice (Phase 7, later):

1. Use generated DTO types at the API boundary.
2. Keep salon-core types inside domain/business logic.
3. Add mapper functions only when generated DTOs differ from domain types.
4. Remove hand-written API DTOs only for that migrated slice.
5. No repo-wide type replacement.

### Errors

- Keep `ApiError` and `NetworkError` as the app-facing error contract.
- Legacy copies live in `src/legacy/errors.ts`.
- Stable shared module: `src/errors.ts`.
- Generated API calls normalize to:
  - `ApiError` — HTTP responses with status codes
  - `NetworkError` — network/fetch/connectivity failures

### React Query usage pattern (for future app migration)

Prefer generated query options directly:

```ts
import { getApiV1ClientsByIdOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'

const query = useQuery({
  ...getApiV1ClientsByIdOptions({ path: { id } }),
  enabled: !!id,
})
```

**Do not** create one wrapper hook per endpoint unless the hook adds meaningful domain behavior (shared staleTime, invalidation, composition).

Phase 5: create `src/react/index.ts` only. **No `useCurrentUser()` or other domain hooks** in this pass.

### Native app

- Native is not in prod. Do not invest in native auth/credentials configuration during Phases 1–6.

### Generated folder

- `src/generated/` is generator-owned. Do not manually edit generated files. Generated files must be reproducible.
- Do not clean or restructure `src/generated/` placeholders until **after** Phase 1 compatibility is confirmed (see implementation order).
- During Phase 3, clean empty placeholder directories under `src/generated/` before HeyAPI setup.
- Do not manually design nested generated folders unless required by HeyAPI config.
- Add `src/generated/README.md` **only if** HeyAPI preserves files in the generated output directory.
- If HeyAPI clears the output folder, do not fight the generator. Instead document the generated-folder rule in `packages/api-client/README.md` and, if HeyAPI supports it, use generated file headers/comments.

---

## Phases

### Phase 1: Preserve existing API client under legacy ✅

**Goal:** Pure file-organization compatibility move. Repo behaves as if nothing changed externally.

**Completed:** Legacy code under `src/legacy/`; root `src/index.ts` re-exports legacy; `src/errors.ts` added; all subpath exports wired; zero app import changes.

**Tasks:**

1. Move existing `packages/api-client/src/*` implementation into `src/legacy/` (except new top-level `errors.ts`, `client.ts`, `react/`, `generated/`).
2. Add `src/legacy/index.ts` re-exporting the legacy barrel.
3. Update root `src/index.ts` to re-export from `./legacy`.
4. Preserve all 13 existing subpath exports pointing at `src/legacy/*`.
5. Add `src/errors.ts` re-exporting `ApiError` / `NetworkError` from legacy.
6. Run typecheck across monorepo.

**Do not:**

- Update app imports
- Replace `createXApi` usage in apps
- Introduce HeyAPI usage in apps
- Remove or rename exported types
- Collapse barrels

**Acceptance criteria:**

- All existing app imports compile unchanged.
- `@repo/api-client/legacy` works.
- `@repo/api-client/errors` works.
- No runtime behavior changes.

---

### Phase 2: Introduce OpenAPI contract (clients first) ✅

**Goal:** Hono API generates a reliable OpenAPI document for the clients route group.

**Completed:** `packages/api-contract/`; OpenAPI routes in `apps/api/src/openapi/`; `pnpm generate:api-contract`; documented in `packages/api-contract/README.md`. Runtime `apps/api/src/routes/clients.ts` behavior unchanged.

**Tasks:**

1. Create `packages/api-contract/` package (or directory) with `openapi.json` output path.
2. Add `@hono/zod-openapi` to `apps/api`.
3. Convert `apps/api/src/routes/clients.ts` to OpenAPI route definitions, reusing `@repo/salon-core/forms/client` schemas where possible.
4. Add generation script in `apps/api` that writes `packages/api-contract/openapi.json`.
5. Validate the generated contract is usable by HeyAPI.
6. Document the contract generation command.

**Guardrail — do not rewrite salon-core schemas globally:**

- Do not refactor all `@repo/salon-core/forms` schemas in Phase 2.
- If `.openapi()` metadata or OpenAPI-specific schema decoration is required, apply it **minimally for the clients route group first**.
- Do not turn Phase 2 into a repo-wide salon-core schema rewrite.
- Add missing response/error schemas only as needed for clients.
- Reuse existing Zod schemas where possible.

**Phase 2 scope remains:**

- Add `@hono/zod-openapi`
- Generate OpenAPI into `packages/api-contract/openapi.json`
- Convert **only** the clients route group first
- Keep existing API runtime behavior unchanged

**Acceptance criteria:**

- `openapi.json` generated with one command (`pnpm generate:api-contract` — see `packages/api-contract/README.md`).
- Clients routes documented with path params, request bodies, response bodies, and auth requirements.
- No hand-editing of `openapi.json`.
- No repo-wide salon-core forms refactor.
- Existing API runtime behavior unchanged.

---

### Phase 3: Add HeyAPI generated client beside legacy ✅

**Goal:** Generated SDK, types, and query options exist alongside legacy client.

**Completed:** `openapi-ts.config.ts`; HeyAPI generates `sdk.gen.ts`, `types.gen.ts`, `@tanstack/react-query.gen.ts`; exports `./sdk`, `./query`, `./types`; `pnpm generate:api-client`. Generated-folder rule in `packages/api-client/README.md` (HeyAPI clears output; no `src/generated/README.md`).

**Tasks:**

1. Clean empty `src/generated/` placeholders (only after Phase 1 typecheck passes).
2. Add HeyAPI config in `packages/api-client` (input: `../api-contract/openapi.json`).
3. Configure output under `src/generated/`.
4. Enable TypeScript SDK, types, and TanStack Query plugin generation.
5. Add `src/generated/README.md` only if HeyAPI preserves non-generated files in the output directory; otherwise document the rule in `packages/api-client/README.md`.
6. Add package exports for `./sdk`, `./query`, `./types`.
7. Add scripts:
   - `packages/api-client/package.json`: `"generate": "openapi-ts"`
   - Root `package.json`: `"generate:api-client": "pnpm --filter @repo/api-client generate"`

**Acceptance criteria:**

- Legacy exports still work.
- `@repo/api-client/sdk`, `/query`, `/types` import successfully.
- Generated files reproducible with `pnpm generate:api-client`.
- Generated files are not manually edited.

---

### Phase 4: Add shared generated client configuration ✅

**Goal:** Apps can configure the generated client without hardcoding env or auth internals.

**Completed:** `configureGeneratedApiClient()` in `src/client.ts`; supports `baseUrl`, `getAccessToken`, `credentials`; normalizes to `ApiError` / `NetworkError`; exported via `./generated-client` only; `src/client.test.ts`.

**Tasks:**

1. Create `packages/api-client/src/client.ts` with `configureGeneratedApiClient()` or `setupGeneratedApiClient()`.
2. Support `baseUrl` and optional `getAccessToken` callback.
3. Support `credentials` if needed for cookie-based web auth.
4. Normalize generated errors to `ApiError` / `NetworkError`.
5. Export configuration via `@repo/api-client/generated-client` only — **not** from the root barrel.
6. Do not import app-specific auth stores into `@repo/api-client`.

**Acceptance criteria:**

- Generated client configurable per app at startup via `@repo/api-client/generated-client`.
- Root `@repo/api-client` still exports legacy only (no `configureGeneratedApiClient` on root barrel).
- No app-specific auth internals in the package.
- No hardcoded API URLs in the package.
- Legacy `createApiClient()` untouched and still available from `@repo/api-client`.

---

### Phase 5: React layer scaffold (no domain hooks) ✅

**Goal:** Export structure exists for future shared hooks. No wrapper-hook layer.

**Completed:** `src/react/index.ts` (empty scaffold with guidance comment); `./react` export wired.

**Tasks:**

1. Create `packages/api-client/src/react/index.ts` (empty or minimal).
2. Add `./react` package export.

**Do not:**

- Create `useCurrentUser()` or per-endpoint wrapper hooks
- Add hooks just to satisfy architecture

**Acceptance criteria:**

- `@repo/api-client/react` exports without breaking builds.
- Folder ready for future domain hooks that add real shared behavior.

---

### Phase 6: Document legacy and new usage ✅

**Goal:** Developers understand both APIs before any app migration.

**Completed:** `packages/api-client/README.md` — legacy vs generated usage, entrypoints, types, errors, generation commands, migration rules.

**Tasks:**

1. Create or update `packages/api-client/README.md`.

**Include:**

- Legacy API usage (`@repo/api-client`, `@repo/api-client/legacy`)
- Generated client setup (`@repo/api-client/generated-client`) — separate from legacy `createApiClient()`
- Generated SDK usage (`@repo/api-client/sdk`)
- Generated query options (`@repo/api-client/query`)
- Type strategy (salon-core domain vs generated DTOs)
- Error contract (`ApiError`, `NetworkError`)
- Generation commands (`pnpm generate:api-client`, API OpenAPI generation)
- Rule: prefer generated query options; custom hooks only for shared domain behavior
- Clear separation: `src/legacy/` (manual) vs `src/generated/` (generator-owned; do not edit)
- Generated-folder rule (here if `src/generated/README.md` is not viable)

**Acceptance criteria:**

- README documents migration rules and both client surfaces.
- Contract generation and client generation commands documented.

---

## Migration inventory (what we are moving)

### Apps and current HTTP layers

| App | HTTP today | Scope |
|-----|------------|-------|
| **PWA** (`apps/pwa`) | Legacy `api` object (`#/lib/api-client.ts`) + `@repo/data-client` offline layer | Primary migration target |
| **Web** (`apps/web`) | Raw `fetch` in `public-api.ts` | Phase 18 |
| **Native** (`apps/native`) | Legacy `createApiClient` in `lib/api.ts` | Phase 19 (not in prod) |

### PWA: dual path today

**Direct legacy API** (~35 files import `#/lib/api-client`):

- Auth/session: `auth.tsx`, `login.tsx`, `signup.tsx`
- Onboarding: `_authed/onboarding/*`, `-steps.ts`
- Clients detail: `clients.$id.tsx` (`api.clients.summary`)
- Staff CRUD (partial): `staff-drawer`, `staff-password-drawer`, `use-staff-page-controller`, onboarding staff step
- Calendar/availability: `calendar.tsx`, `availability-drawer.tsx`
- Reads/aggregates: `dashboard`, `retention`, `requests`, `public-page`, `settings` (partial)
- Today: `manager-today-provider`, `staff-today-provider`, `use-staff-today-status-mutation`
- Messaging/notifications: `use-messaging-connect`, `messaging-accounts-section`, `bottom-nav`

**data-client offline path** (~40 files):

- Provider: `ManagerDataClientProvider` in `_authed.tsx`
- Collection hooks: `use-manager-collection`, `manager-data-queries` (clients, staff, services, catalog, business settings, schedules)
- Mutations: `use-manager-mutation`, drawers (clients, staff, services, addons, categories, families)
- Calendar/appointments: `calendar.tsx`, appointment detail, intake mutations
- Offline UX: `manager-sync-bar`, `offline-state`, IndexedDB hooks, `clearOfflineDatabase` on auth

### OpenAPI coverage today

| Route group | OpenAPI | Legacy module | data-client module |
|-------------|---------|---------------|-------------------|
| clients | ✅ | `legacy/clients.ts` | `clients-module` |
| staff | ✅ | `legacy/staff.ts` | `staff-module` |
| services (+ categories, families, addons) | ✅ | `legacy/services.ts` | `services-module` |
| appointments (+ availability) | ❌ | `legacy/appointments.ts` | `appointments-module` |
| appointment-requests | ❌ | `legacy/appointment-requests.ts` | — |
| business-settings | ❌ | `legacy/business-settings.ts` | `business-settings-module` |
| salon-profile / salon-public-settings | ❌ | `legacy/salon-profile.ts`, `salon-public-settings.ts` | — |
| onboarding | ❌ | `legacy/onboarding.ts` | — |
| dashboard / today / retention | ❌ | `legacy/dashboard.ts`, `today.ts`, `retention.ts` | `today-module` |
| messaging / notifications | ❌ | `legacy/messaging.ts`, `notifications.ts` | — |
| auth | ❌ (stay legacy) | `legacy/auth.ts` | `session-module` |
| public booking | ❌ (Phase 18) | — | — |
| push / webhooks / health | ❌ (excluded) | — | — |

### Per-slice migration pattern

Each vertical slice follows the same steps:

```txt
1. Add OpenAPI routes in apps/api/src/openapi/ (reuse salon-core Zod schemas)
2. pnpm generate:api-contract && pnpm generate:api-client
3. Wire configureGeneratedApiClient() if not already (Phase 7)
4. Replace legacy api.* calls with generated query/mutation options
5. Replace data-client collection/mutation hooks for that domain
6. Migrate query keys + invalidation together (legacy keys → generated keys)
7. Remove offline UI/hooks for that domain only (see “Offline cleanup per slice” below)
8. Delete legacy module usage for that slice when grep shows zero consumers
```

**Always migrate together per slice:** queries, mutations, invalidation, and error handling (`ApiError` / `NetworkError`).

**Do not:** big-bang replace all `api.*` usage; create wrapper hooks per endpoint; rewrite salon-core schemas globally.

### Offline cleanup per slice (Phases 8–16)

Migrated domains are **online-only**. When a slice moves to the generated client, remove offline-era code for that domain in the same PR — do not carry forward `manager-write-policy` / `useNetworkStatus` guards into new `*-queries.ts` hooks.

**Remove from the migrated slice:**

- `useManagerWriteMutation` / `useManagerMutation` for that domain
- `assertOnlineForWrite`, `useNetworkStatus`, and `enabled: isOnline` gating on queries/mutations
- IndexedDB projection hooks (`use-*-indexeddb.ts`) and offline snapshot UI (`NetworkStatusBanner`, `OfflineStateCard`) on those screens
- The domain’s `MANAGER_WRITE_OPERATIONS` entry in `manager-write-policy.ts` once nothing references it

**Keep until Phase 17 (repo-wide):** `ManagerDataClientProvider`, `use-manager-collection`, global sync bar — other unmigrated domains still use them.

**Network failures:** let generated client throw `NetworkError` / `ApiError`; rely on React Query error state and existing mutation toasts — no bespoke offline pre-checks in migrated hooks.

**Phase 8 (clients) done:** no `client.save` in write policy; no offline guards in `clients-queries.ts` or clients screens.

**Phase 9 (staff) done:** no `staff.*` in write policy; staff screens use `staff-queries.ts`.

**Phase 10 (services) done:** no `service.save` / `serviceCategory.save` / `serviceFamily.save` / `serviceAddon.save` in write policy; catalog screens use `services-queries.ts`.

---

## Phases 7–20: App migration execution plan

### Phase 7: App foundation (PWA)

**Goal:** Generated client is configured and usable alongside legacy during migration.

**OpenAPI:** none (clients already generated).

**Tasks:**

1. Call `configureGeneratedApiClient({ baseUrl, credentials: 'include' })` at PWA startup (e.g. alongside `#/lib/api-client.ts` wiring in app bootstrap).
2. Document dual-run rule: legacy `api` stays until each slice is migrated; generated options used only in migrated files.
3. Add a small `#/lib/generated-api-client.ts` (or extend bootstrap) — keep auth stores outside `@repo/api-client`.
4. Optional hygiene (non-blocking): eslint ignore for `packages/api-client/src/generated/`; fix `@repo/auth` ↔ `@repo/database` turbo cycle so root `pnpm typecheck` passes.

**Acceptance criteria:**

- PWA boots with both legacy and generated clients configured.
- A smoke test can call `getApiV1ClientsOptions()` successfully when authenticated.
- No existing screens changed yet (zero behavior change).

---

### Phase 8: Clients (pilot slice)

**Goal:** First end-to-end proof — OpenAPI already exists; replace both legacy and data-client client flows.

**OpenAPI:** ✅ already in `apps/api/src/openapi/routes/clients.ts`.

**App scope:**

| Area | Current | Target |
|------|---------|--------|
| List | `useManagerClientsQuery` + IndexedDB | `getApiV1ClientsOptions` |
| Detail/summary | `api.clients.summary` | `getApiV1ClientsByIdSummaryOptions` |
| Drawer CRUD | data-client mutations | `postApiV1ClientsMutation`, `patchApiV1ClientsByIdMutation` |
| Follow-ups | legacy `api.clients` | `postApiV1ClientsByIdFollowUpsMutation` |
| Retention sidebar on clients page | `api.retention` | defer to Phase 15 or keep legacy call temporarily |

**Key files:** `clients.tsx`, `clients.$id.tsx`, `client-drawer.tsx`, `manager-data-queries.ts` (clients hook), `use-clients-indexeddb.ts`, `query-keys.ts`.

**Acceptance criteria:**

- Clients list/detail/CRUD/follow-ups work online-only (no IndexedDB fallback for clients).
- Query invalidation uses generated query keys.
- `grep api.clients` and `useManagerClientsQuery` show zero consumers (except retention if deferred).
- No `assertOnlineForWrite`, `useNetworkStatus`, or offline UI on clients screens / `clients-queries.ts`; `client.save` removed from `manager-write-policy.ts`.
- E2E or manual: create, edit, search, open detail, add follow-up.

---

### Phase 9: Staff

**Goal:** Staff management off data-client and legacy staff API.

**OpenAPI:** add `apps/api/src/openapi/routes/staff.ts` (+ schemas) — list, create, update, delete, password, schedule bundle, booking availability, service assignments.

**App scope:**

- `staff.index.tsx`, `staff.$id.tsx`, staff drawers/modals, `use-staff-page-controller`
- `useManagerStaffQuery`, schedule bundle query
- Onboarding staff step (`onboarding/staff.tsx`) — partial legacy today
- `api.staff.*` in staff-password-drawer, staff-drawer

**Acceptance criteria:**

- Staff list, CRUD, schedule, password, services assignment on generated options.
- No `dc.staff.*` or `api.staff.*` in migrated files.
- Offline cleanup per slice: no `useManagerWriteMutation` for staff on migrated screens; remove `staff.create` / `staff.update` / `staff.updatePassword` / `staff.delete` from write policy when migrated; no `assertOnlineForWrite` or offline UI on staff screens.

---

### Phase 10: Services catalog

**Goal:** Services, categories, families, addons off data-client.

**OpenAPI:** `services`, `service-categories`, `service-families`, `service-addons` route groups.

**App scope:**

- `services.tsx`, `service-catalog-manager`, all service drawers (service, category, family, addon)
- `useManagerServicesQuery`, `useManagerServiceCatalogQuery`, `useManagerAddonsQuery`
- `use-service-addons.ts` (`api.services.addons`)
- Onboarding services step, `catalog-preset-picker`

**Acceptance criteria:**

- Full catalog CRUD on generated options.
- Starter template import works (OpenAPI for `import-starter-templates` if used).

---

### Phase 11: Appointments & calendar

**Goal:** Calendar and appointment flows off data-client + legacy appointments API.

**OpenAPI:** `appointments` (+ `availability` sub-routes).

**App scope:**

- `calendar.tsx`, `availability-drawer.tsx`, appointment detail drawer/hooks
- `use-appointment-intake-mutations`, `appointment-intake`, `client-picker`
- data-client `appointments-module`, today IndexedDB hooks tied to calendar

**Acceptance criteria:**

- Create/edit/cancel/complete appointments via generated mutations.
- Availability queries use generated options.
- Calendar renders without offline projection for appointments.

**Note:** Highest complexity slice — do after staff/services/clients are stable (shared pickers depend on them).

---

### Phase 12: Appointment requests

**Goal:** Manager requests inbox off legacy API.

**OpenAPI:** `appointment-requests` route group.

**App scope:** `routes/_authed/requests.tsx` (approve/reject/list).

**Acceptance criteria:**

- Requests page fully on generated query/mutation options.

---

### Phase 13: Settings & public page

**Goal:** Business settings, salon profile, public page settings off legacy + data-client.

**OpenAPI:** `settings/business`, `salon-profile`, `salon-public-settings`.

**App scope:**

- `settings.tsx` (business settings via data-client today)
- `public-page.tsx`, `slug-editor`, `presence-form`
- `useManagerBusinessSettingsQuery`

**Acceptance criteria:**

- Settings and public page save/load via generated options.

---

### Phase 14: Onboarding

**Goal:** Onboarding wizard off legacy onboarding API.

**OpenAPI:** `onboarding` route group (status + step actions).

**App scope:**

- `_authed/onboarding.tsx`, `-steps.ts`, all step routes (`hours`, `staff`, `services`, `public`, `notifications`, `done`)
- `_authed.tsx` onboarding gate query

**Acceptance criteria:**

- Full onboarding flow on generated options.
- Step transitions and completion work; staff/services steps already migrated in Phases 9–10 reuse generated calls.

**Note:** Cross-cuts other slices — best done after Phases 9–10 so step screens don't call legacy APIs.

---

### Phase 15: Dashboard, today & retention

**Goal:** Read-heavy aggregates and today views off legacy API.

**OpenAPI:** `dashboard`, `today`, `retention`.

**App scope:**

- `dashboard.tsx`, `retention.tsx`, `clients.tsx` retention query
- `manager-today-provider`, `staff-today-provider`, `manager-today-screen`
- `use-staff-today-status-mutation`, `bottom-nav` notification badge (if not done in Phase 16)

**Acceptance criteria:**

- Dashboard, today, retention on generated query options.
- Today views no longer depend on data-client `today-module`.

---

### Phase 16: Messaging & notifications

**Goal:** Messaging connect and notification preferences off legacy API.

**OpenAPI:** `messaging`, `notifications`, `notification-preferences`.

**App scope:**

- `use-messaging-connect.ts`, `messaging-accounts-section.tsx`
- Onboarding notifications step
- Any remaining `api.notifications.*` usage

**Acceptance criteria:**

- Connect/disconnect messaging, list accounts, notification prefs on generated options.

---

### Phase 17: Remove `@repo/data-client`

**Goal:** Delete offline layer after Phases 8–16 migrated all data-client domains.

**Prerequisite:** Zero imports from `@repo/data-client` in PWA (grep clean).

**Tasks:**

1. Remove `ManagerDataClientProvider`, `manager-data-client.tsx`.
2. Remove `use-manager-collection`, `use-manager-mutation`, offline hooks, IndexedDB adapters usage.
3. Remove offline UX: `manager-sync-bar`, `offline-state`, `clearOfflineDatabase` from auth/signup/login.
4. Delete `packages/data-client` and portability package.
5. Remove data-client from PWA `package.json`, turbo pipeline, any CI references.

**Acceptance criteria:**

- PWA has no offline/sync code paths.
- `packages/data-client` deleted.
- Manager app is online-only with generated client.

---

### Phase 18: Web public booking API

**Goal:** Astro public site uses generated SDK instead of raw fetch.

**OpenAPI:** `public` route group (`/api/v1/public/*`).

**App scope:** `apps/web/src/lib/public-api.ts` → `@repo/api-client/sdk`.

**Acceptance criteria:**

- Public salon view, availability, appointment request flows use generated SDK.
- Server-side Astro loaders use `@repo/api-client/sdk` with `configureGeneratedApiClient` or per-request client config.

---

### Phase 19: Native app (when scoped)

**Goal:** Native app on generated client — only when native is in prod scope.

**OpenAPI:** reuse route groups from Phases 8–16; auth stays legacy (`createAuthApi` / Better Auth passthrough).

**App scope:** `apps/native/lib/api.ts` and ~20 component files using legacy types/errors.

**Acceptance criteria:**

- Native uses `configureGeneratedApiClient({ getAccessToken })` + generated options.
- Auth/signup/login remain legacy until Saluna-owned auth wrappers are OpenAPI-documented.

---

### Phase 20: Legacy cleanup

**Goal:** Remove hand-written client after all apps migrated.

**Tasks:**

1. Grep monorepo for `@repo/api-client` legacy imports (`createApiClient`, `createXApi`, legacy subpaths).
2. Remove unused `src/legacy/*` modules one at a time.
3. Switch root `@repo/api-client` barrel to re-export generated surface (or keep explicit `./legacy` export temporarily).
4. Remove legacy subpath exports when unused.
5. Update README to generated-first.

**Acceptance criteria:**

- `src/legacy/` deleted (except auth if still required).
- Root export documents generated API as primary.
- `pnpm generate:api-contract` + `pnpm generate:api-client` remain the source of truth.

---

## Recommended execution order

```txt
Phase 7   App foundation (dual-run generated + legacy)
Phase 8   Clients          ← pilot; OpenAPI ready
Phase 9   Staff
Phase 10  Services catalog
Phase 11  Appointments     ← highest complexity; after 8–10
Phase 12  Appointment requests
Phase 13  Settings & public page
Phase 14  Onboarding       ← after 9–10 (step screens)
Phase 15  Dashboard, today, retention
Phase 16  Messaging & notifications
Phase 17  data-client removal
Phase 18  Web public API
Phase 19  Native (when scoped)
Phase 20  Legacy cleanup
```

**Parallelism:** OpenAPI for Phase N+1 can be drafted while Phase N app migration is in review. Do not migrate app screens before their OpenAPI contract exists.

**Auth stays legacy through Phase 20** unless Saluna adds stable OpenAPI wrappers for `/api/v1/auth/*`.

---

## Implementation order

### Phases 1–6 (complete)

```txt
 ✅ 1. Phase 1: Move api-client src → src/legacy/; wire all exports; add src/errors.ts
 ✅ 2. Typecheck — confirm zero app import changes needed
 ✅ 3. Clean empty packages/api-client/src/generated/ placeholders
 ✅ 4. Phase 2: Create packages/api-contract/; add @hono/zod-openapi; migrate clients routes
 ✅ 5. Phase 2: Add API script → packages/api-contract/openapi.json
 ✅ 6. Phase 3: HeyAPI config; generate sdk / query / types
 ✅ 7. Phase 4: configureGeneratedApiClient() + error normalization; export via ./generated-client
 ✅ 8. Phase 5: src/react/index.ts scaffold
 ✅ 9. Phase 6: packages/api-client/README.md
 ⚠️ 10. Root generate:api-client script (done); full root typecheck/lint pass blocked by turbo cycle
```

### Phases 7–20 (app migration — start here)

```txt
 ✅ 7.  Wire configureGeneratedApiClient() in PWA (dual-run; no screen changes)
 ✅ 8.  Clients slice (OpenAPI ✅) — replace legacy + data-client
 ✅ 9.  OpenAPI staff → migrate staff screens
 ✅ 10. OpenAPI services → migrate catalog
 → 11. OpenAPI appointments → migrate calendar
 → 12. OpenAPI appointment-requests → migrate requests inbox
 → 13. OpenAPI settings/public → migrate settings + public page
 → 14. OpenAPI onboarding → migrate wizard
 → 15. OpenAPI dashboard/today/retention → migrate aggregates
 → 16. OpenAPI messaging/notifications → migrate connect + prefs
 → 17. Remove @repo/data-client + offline UX
 → 18. OpenAPI public → migrate apps/web
 → 19. Native (when scoped)
 → 20. Delete src/legacy/
```

---

## Agent checklist

### Phases 1–6 (complete)

- [x] Confirm monorepo uses `pnpm@9.15.9`
- [x] List all `packages/api-client` public exports and subpaths
- [x] Grep app imports from `@repo/api-client` (root barrel only; no generated imports in apps)
- [x] Note PWA dual path: `api-client` vs `data-client` (data-client untouched)
- [x] Preserve legacy behavior first
- [x] Do not edit generated files manually
- [x] Keep app-specific auth outside `@repo/api-client`
- [x] No app migration (Phase 7 deferred)
- [x] `packages/api-client` typecheck passes
- [x] Legacy imports work (`createApiClient` from `@repo/api-client`)
- [x] Generated config importable from `@repo/api-client/generated-client` (not root barrel)
- [x] Generated imports work (`sdk`, `query`, `types`)
- [x] `pnpm generate:api-client` reproduces generated output
- [x] No app files changed for migration
- [ ] Root `pnpm typecheck` passes — blocked by `@repo/auth` ↔ `@repo/database` turbo cycle
- [ ] Root `pnpm lint` passes — same turbo cycle; plus generated-file eslint noise in api-client

### Phases 7–20 (app migration)

- [x] Phase 7: Wire `configureGeneratedApiClient()` in PWA (dual-run with legacy)
- [x] Phase 8: Clients slice — generated query/mutation + invalidation; drop clients data-client path
- [x] Phase 9: OpenAPI staff + migrate staff screens
- [x] Phase 10: OpenAPI services catalog + migrate services screens
- [ ] Phase 11: OpenAPI appointments + migrate calendar
- [ ] Phase 12: OpenAPI appointment-requests + migrate requests
- [ ] Phase 13: OpenAPI settings/public + migrate settings & public page
- [ ] Phase 14: OpenAPI onboarding + migrate wizard
- [ ] Phase 15: OpenAPI dashboard/today/retention + migrate reads
- [ ] Phase 16: OpenAPI messaging/notifications + migrate connect/prefs
- [ ] Phase 17: Remove `@repo/data-client` and offline UX
- [ ] Phase 18: OpenAPI public + migrate `apps/web`
- [ ] Phase 19: Native (when scoped)
- [ ] Phase 20: Delete `src/legacy/` when grep clean
- [ ] Prefer generated query options over endpoint wrapper hooks
- [ ] Expand OpenAPI contract **before** migrating screens for each route group
- [ ] Migrate query keys + invalidation together per slice
- [ ] Per slice: remove offline guards (`assertOnlineForWrite`, `useNetworkStatus` gating, offline UI, write-policy entries) — see “Offline cleanup per slice”
- [ ] Keep auth on legacy until OpenAPI wrappers exist

---

## Compatibility risks to watch

| Risk | Mitigation |
|------|------------|
| Query key changes (Phase 7) | Migrate query + invalidation together per slice |
| Error shape changes | Normalize to `ApiError` / `NetworkError` in generated client config |
| Duplicate types (salon-core vs generated) | Generated DTOs at boundary; mappers only when needed |
| data-client parallel HTTP layer | Migrate domain-by-domain in Phases 8–16; remove package in Phase 17 |
| Clients uses both legacy + data-client | Phase 8 replaces both paths together (pilot slice) |
| Onboarding cross-cuts staff/services | Phase 14 after Phases 9–10 |
| Calendar depends on clients/staff/services | Phase 11 after Phases 8–10 |
| Better Auth passthrough | Keep legacy `createAuthApi`; exclude from first OpenAPI pass |

---

## Final target state (after full migration, later)

```txt
Legacy client        → removed after all consumers migrated
Generated SDK        → raw API calls and server-side usage
Generated query opts → React Query primitives in apps
Custom hooks         → small domain layer only, when justified
data-client          → removed (offline support dropped)
Apps                 → compose behavior locally with generated options
```

---

## Plan acceptance criteria

### Phases 1–6 (verified)

- [x] Phase 1 happened **before** generated folder cleanup.
- [x] `./generated-client` exists as the generated config entrypoint.
- [x] Root `@repo/api-client` exports **legacy only**.
- [x] Generated config is imported from `@repo/api-client/generated-client`.
- [x] Existing `createApiClient()` remains available from `@repo/api-client`.
- [x] HeyAPI owns `src/generated/`.
- [x] Generated-folder rule documented in `packages/api-client/README.md` (no `src/generated/README.md` — HeyAPI clears output).
- [x] Phase 2 did **not** rewrite all salon-core schemas.
- [x] No app migration occurred.

### Hard constraints (Phases 7–20)

- Migrate by vertical slice — not big-bang.
- OpenAPI before app screens for each route group.
- Better Auth passthrough stays legacy until Saluna-owned wrapper routes have stable OpenAPI schemas.
- Public booking (Phase 18), push, messaging webhooks, and health excluded until their phases.
- Prefer generated query options directly; custom hooks only for shared domain behavior.
- Migrated slices are online-only: no `assertOnlineForWrite` / `useNetworkStatus` in generated `*-queries.ts` hooks; remove write-policy entries per domain as each slice lands.
- `@repo/data-client` removal is Phase 17 — after CRUD domains are on generated client.
- Native is Phase 19 — only when in prod scope.
- Dual-run legacy + generated during migration; remove legacy per slice when grep clean.
