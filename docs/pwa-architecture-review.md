# PWA Architecture Review — Deepening Opportunities

> **Status:** Candidates #1–#5 implemented on branch (2026-06-02)  
> **Scope:** `apps/pwa` (TanStack Router + Vite manager PWA)  
> **Date:** 2026-06-02  
> **Method:** `/improve-codebase-architecture` — see `.agents/skills/improve-codebase-architecture/SKILL.md`

## How to use this document (subagent instructions)

1. Read domain language first: [`CONTEXT.md`](../CONTEXT.md) (especially **Offline Projection**, **Appointment Intake**, **Appointment Detail Read Model**).
2. Read ADRs before proposing changes that touch requests or availability: [`docs/adr/0001-appointment-request-as-distinct-aggregate.md`](adr/0001-appointment-request-as-distinct-aggregate.md), [`docs/adr/0002-no-soft-hold-on-pending-requests.md`](adr/0002-no-soft-hold-on-pending-requests.md).
3. Migration context: [`docs/pwa-migration-plan.md`](pwa-migration-plan.md) — PWA replaces `retired manager app`; Hono API at `/api/v1` is the only backend boundary.
4. Pick **one** numbered candidate below and enter the **grilling loop** (design tree: constraints, interface shape, tests). Do not implement multiple candidates in one pass unless the user asks.
5. Use architecture vocabulary from [LANGUAGE.md](https://github.com/cursor/skills/blob/main/improve-codebase-architecture/LANGUAGE.md): **module**, **interface**, **seam**, **adapter**, **depth**, **locality**, **leverage**, **deletion test**.
6. Use domain vocabulary from `CONTEXT.md` — not generic terms like "service layer" or "boundary."

**Suggested skills for follow-up work:**

| Skill | When |
|-------|------|
| `improve-codebase-architecture` | Continue grilling / interface design |
| `grill-with-docs` | New domain terms → update `CONTEXT.md`; load-bearing rejections → offer ADR |
| `vercel-composition-patterns` | Splitting god routes into compound components / providers |
| `vercel-react-best-practices` | Query cache / data-fetch refactors |
| `hono` | If write/read seam touches API client shape |

---

## Executive summary

The PWA is ahead of `retired manager app` on **Offline Projection** and view-model extraction, but several **seams are split** — offline behavior, read caches, and write policies leak into route files and large drawers. Five lib unit tests exist; UI and integration seams are largely untested.

**Strongest within-PWA candidates:** #1 (offline), #2 (reads), #3 (writes).  
**Largest locality wins for features:** #4 (appointment surface), #5 (today screen).  
**Migration-shaped:** #7 (cross-app duplication).

---

## Stack and structure

| Layer | Path | Role |
|-------|------|------|
| Bootstrap | `apps/pwa/src/main.tsx` | `QueryClientProvider` → `ThemeProvider` → `AuthProvider` → Router |
| Router | `apps/pwa/src/router.tsx`, `routeTree.gen.ts` | File-based routes; context carries `queryClient` |
| Env | `apps/pwa/src/env.ts` | `VITE_API_BASE_URL`, PWA asset version |
| PWA shell | `apps/pwa/public/sw.js`, `components/pwa/*`, `lib/pwa-assets.ts` | Service worker + install prompt |

**Imports:** `#/*` → `./src/*` (`apps/pwa/package.json`).

### Routes

**Public:** `/`, `/login`, `/signup`

**Authed** (`routes/_authed.tsx`): auth gate, onboarding redirect, `ManagerDataClientProvider`, `ManagerSyncBar`, `BottomNav`

| Path | File | Notes |
|------|------|-------|
| `/today` | `_authed/today.tsx` | ~1500 lines — manager + staff |
| `/calendar` | `_authed/calendar.tsx` | ~624 lines |
| `/clients`, `/clients/$id` | `_authed/clients.tsx`, `clients.$id.tsx` | |
| `/dashboard` | `_authed/dashboard.tsx` | |
| `/services` | `_authed/services.tsx` | |
| `/staff` | `_authed/staff.tsx` | |
| `/settings` | `_authed/settings.tsx` | |
| `/requests` | `_authed/requests.tsx` | ~642 lines — online-only by ADR |
| `/retention` | `_authed/retention.tsx` | |
| `/public-page` | `_authed/public-page.tsx` | |
| `/onboarding/*` | `_authed/onboarding/` | `-steps.ts`, `-shell.tsx` colocated |

### Key `lib/` modules

| Area | Files |
|------|-------|
| Data / offline | `api-client.ts`, `manager-data-client.tsx`, `manager-data-queries.ts`, `use-manager-collection.ts`, `use-manager-mutation.ts`, `offline-projection.ts`, `offline-snapshot.ts`, `use-manager-today-indexeddb.ts`, `use-calendar-indexeddb-sources.ts`, `use-clients-indexeddb.ts` |
| View models (tested) | `today-view-model.ts`, `next-open-slot.ts`, `appointment-detail-view-model.ts` |
| Infra | `auth.tsx`, `query-client.ts`, `query-keys.ts`, `network-status.ts`, `theme.tsx` |

### Shared packages

`@repo/salon-core`, `@repo/api-client`, `@repo/data-client`, `@repo/ui`, `@repo/brand-tokens`

### PWA vs `retired manager app`

| PWA | Legacy app |
|-----|------------|
| TanStack Router, direct Hono via `VITE_API_BASE_URL` | Next.js App Router, `/api` BFF rewrites |
| `useOfflineProjection` + route adapters | Inline IndexedDB today hook |
| `useManagerCollection` / `manager-data-queries` | Similar but diverged |
| Extracted view models + 5 unit tests | Logic inline in large page files |

Parallel duplicated components: `appointment-drawer.tsx`, `service-catalog-manager.tsx`, `bottom-nav.tsx`, `manager-sync-bar.tsx`, many drawers under `components/calendar/` and `components/services/`.

---

## Existing tests (PWA only)

All under `apps/pwa/src/lib/`:

| Test file | Subject |
|-----------|---------|
| `offline-projection.test.ts` | `selectOfflineProjectionPhase` |
| `today-view-model.test.ts` | Manager/staff view model builders |
| `appointment-detail-view-model.test.ts` | Edit form/view-model helpers |
| `use-manager-collection.test.tsx` | Query + subscribe wiring (mocked) |
| `use-manager-mutation.test.tsx` | `processPending` on success (mocked) |

**Untested:** all route files, large drawers, `auth.tsx`, `manager-sync-bar.tsx`, cross-key cache coherence, `public/sw.js`.

---

## Friction index (quick lookup)

| Friction | Primary files |
|----------|---------------|
| Offline terminology overload | `CONTEXT.md`, `lib/offline-projection.ts`, `lib/offline-snapshot.ts`, `packages/data-client/src/core/offline-projection.ts` |
| Manager vs staff today offline | `_authed/today.tsx`, `use-manager-today-indexeddb.ts`, `offline-snapshot.ts` |
| Split query caches | `query-keys.ts`, `manager-data-queries.ts`, `_authed/today.tsx`, `_authed/calendar.tsx`, `_authed/staff.tsx` |
| Inconsistent writes | `use-manager-mutation.ts`, `appointment-detail-drawer.tsx`, `today.tsx`, `service-drawer.tsx`, `requests.tsx` |
| Monolithic today | `_authed/today.tsx`, `today-view-model.ts` |
| Monolithic appointment UI | `appointment-detail-drawer.tsx`, `appointment-drawer.tsx`, `appointment-detail-view-model.ts` |
| Onboarding guards split | `onboarding/-steps.ts`, `onboarding.tsx`, `_authed.tsx` |
| Cross-app duplication | `apps/pwa/src/**` ↔ `retired manager app/**` |

---

## Deepening opportunities

Each candidate follows: **Files → Problem → Solution → Benefits → Deletion test → ADR notes**.

---

### 1. Unify the Offline Projection module

**Priority:** High  
**Status:** Done

**Files:**

- `apps/pwa/src/lib/offline-projection.ts`
- `apps/pwa/src/lib/offline-snapshot.ts`
- `apps/pwa/src/lib/use-manager-today-indexeddb.ts`
- `apps/pwa/src/lib/use-calendar-indexeddb-sources.ts`
- `apps/pwa/src/lib/use-clients-indexeddb.ts`
- `apps/pwa/src/routes/_authed/today.tsx`
- `apps/pwa/src/components/offline-state.tsx`
- `packages/data-client/src/core/offline-projection.ts` (related — different module, same term)

**Problem:**

Three meanings of "offline" coexist:

1. **UI Offline Projection** (`CONTEXT.md`) — live → empty → IndexedDB snapshot for manager routes
2. **Staff today localStorage** — `offline-snapshot.ts` + keys like `today:staff:${date}` in `today.tsx`
3. **Data-client list projection** — pending mutations merged into lists in `@repo/data-client`

Route adapter hooks repeat phase-mapping logic. Understanding one offline read requires 6+ files.

**Solution:**

One **Offline Projection** module with a single interface for "what to show when network or IndexedDB state changes." Adapters for manager IndexedDB vs staff localStorage sit behind that seam — not parallel concepts in route files.

**Benefits:**

- **Locality:** precedence rules in one place (partially done in `selectOfflineProjectionPhase`)
- **Leverage:** every manager screen shares phase semantics
- **Tests:** interface-level phase transitions without full route trees

**Deletion test:** Removing `offline-projection.ts` + adapter hooks **spreads** phase logic into `today`, `calendar`, `clients` (reverts toward `retired manager app` style).

**ADR notes:** None.

---

### 2. Consolidate manager read paths (split query caches)

**Priority:** High  
**Status:** Done

**Files:**

- `apps/pwa/src/lib/query-keys.ts`
- `apps/pwa/src/lib/manager-data-queries.ts`
- `apps/pwa/src/lib/use-manager-collection.ts`
- `apps/pwa/src/routes/_authed/today.tsx`
- `apps/pwa/src/routes/_authed/calendar.tsx`
- `apps/pwa/src/routes/_authed/staff.tsx`
- `apps/pwa/src/routes/_authed/services.tsx`

**Problem:**

Same salon entities (staff, clients, services) use two incompatible React Query caches:

- Data-client keys: `['manager', 'staff']` via `useManagerStaffQuery`
- HTTP keys: `['staff', 'list']`, `['services', 'list']`, `['clients']` via `api.*.list`

Updating staff on `/staff` does not refresh `/today` or `/calendar`.

**Solution:**

One **manager read** module owning fetch, subscribe, and invalidation for staff/clients/services — whether source is IndexedDB projection or live API list.

**Benefits:**

- **Locality:** cache invalidation in one place
- **Leverage:** new screens import one read interface
- **Tests:** cross-screen coherence without route integration tests

**Deletion test:** Removing `manager-data-queries.ts` **spreads** `useManagerCollection` boilerplate to each route.

**ADR notes:** None.

---

### 3. Deepen the write / mutation policy seam

**Priority:** High  
**Status:** Done

**Files:**

- `apps/pwa/src/lib/use-manager-mutation.ts`
- `apps/pwa/src/lib/query-client.ts`
- `apps/pwa/src/lib/use-service-addons.ts`
- `apps/pwa/src/components/calendar/appointment-detail-drawer.tsx`
- `apps/pwa/src/routes/_authed/today.tsx`
- `apps/pwa/src/routes/_authed/requests.tsx`
- Most service/staff drawers (`service-drawer.tsx`, `staff-drawer.tsx`, etc.)

**Problem:**

Three write patterns coexist:

| Pattern | Offline queue? | Examples |
|---------|----------------|----------|
| `useManagerMutation` | Yes (`processPending`) | appointment detail, client drawers |
| `useMutation` + `DataClient` | Partial | service/staff drawers |
| `useMutation` + `api.*` only | No | requests, staff status on today, settings, onboarding |

Staff **Appointment** status on `/today` uses online-only API; manager edits use offline queue — same domain concept, different capability.

`use-service-addons.ts` branches on `useManagerDataClient()` null vs non-null at call site.

**Solution:**

One **write policy** module encoding per operation: queue offline, require online, or read-through-only. Callers use one mutation interface; module picks adapter.

**Benefits:**

- **Locality:** "what happens when offline" currently at ~30 call sites
- **Leverage:** new mutations get correct offline behavior by default
- **Tests:** policy table without mocking every drawer

**Deletion test:** Removing `use-manager-mutation.ts` **spreads** `processPending` calls; loses single write seam.

**ADR notes:** **AppointmentRequest** approve/reject must stay online-only (ADR-0001, ADR-0002). Module should encode this — do not re-litigate.

---

### 4. Extract an Appointment surface module from god routes/drawers

**Priority:** Medium (high locality win)  
**Status:** Done

**Files:**

- `apps/pwa/src/routes/_authed/today.tsx`
- `apps/pwa/src/components/calendar/appointment-drawer.tsx` (~831 lines)
- `apps/pwa/src/components/calendar/appointment-detail-drawer.tsx` (~1316 lines)
- `apps/pwa/src/lib/appointment-detail-view-model.ts`
- `apps/pwa/src/lib/use-staff-booking-availability.ts`
- `apps/pwa/src/components/calendar/availability-drawer.tsx`

**Problem:**

One **Appointment** touch spans create drawer, detail drawer, availability drawer, calendar/today orchestration, and search-param deep links. `appointment-detail-view-model.ts` is tested but only imported from detail drawer — most behavior remains in large components.

**Solution:**

Deepen around **Appointment Intake** (create/edit/status) and **Appointment Detail Read Model**. Interface covers "open create," "open edit," "change status," "resolve availability"; drawers become thin UI adapters.

**Benefits:**

- **Locality:** intake rules and form state
- **Leverage:** calendar and today share one intake module
- **Tests:** existing view-model tests become core surface; drawer tests shrink to rendering

**Deletion test:** Removing view models **concentrates** logic back into ~1300-line drawers.

**ADR notes:** None for manager flows. Request approval stays separate (ADR-0001).

---

### 5. Deepen the Today screen module (manager vs staff)

**Priority:** Medium  
**Status:** Done

**Files:**

- `apps/pwa/src/routes/_authed/today.tsx`
- `apps/pwa/src/lib/today-view-model.ts`
- `apps/pwa/src/lib/use-manager-today-indexeddb.ts`
- `apps/pwa/src/lib/offline-snapshot.ts`
- `apps/pwa/src/components/today-skeleton.tsx`

**Problem:**

`/today` hosts two products in one file:

- **Manager today:** IndexedDB projection, concurrent appointments, review queue links
- **Staff today:** localStorage snapshot, online-only status API

View-model extraction started; route still owns cards, offline UX, drawers, role branching.

**Solution:**

Explicit variants — **ManagerToday** and **StaffToday** — each with its own provider (data source + write policy) composing shared presentation. Route becomes thin role router.

**Benefits:**

- **Locality:** manager/staff divergence currently interleaved
- **Leverage:** `today-view-model.ts` tests per role through small interfaces
- Aligns with compound component / provider patterns

**Deletion test:** Removing `today-view-model.ts` **concentrates** ~1500 lines in route file.

**ADR notes:** None.

---

### 6. Onboarding progression as one module

**Priority:** Lower  
**Status:** Not started

**Files:**

- `apps/pwa/src/routes/_authed/onboarding/-steps.ts`
- `apps/pwa/src/routes/_authed/onboarding.tsx`
- `apps/pwa/src/routes/_authed.tsx`
- `apps/pwa/src/routes/_authed/onboarding/*.tsx`

**Problem:**

Guards split between `_authed.tsx` (checks only `servicesAdded` / `staffAdded`) and `-steps.ts` (full step graph with `guardStep` / `firstIncompleteStep`).

**Solution:**

One **onboarding progression** module: step graph, completion predicates, redirect targets. Layout and step routes consume same interface.

**Benefits:**

- **Locality:** step ordering and skip rules
- **Leverage:** new step = one graph update
- **Tests:** walk progression without full router

**Deletion test:** Removing `-steps.ts` **spreads** guard logic across route files.

**ADR notes:** None.

---

### 7. Cross-app duplication seam (PWA ↔ legacy app)

**Priority:** Migration-shaped — defer until slice stable  
**Status:** Not started

**Files:**

- Parallel trees: `apps/pwa/src/**` ↔ `retired manager app/**`
- Examples: `appointment-drawer.tsx`, `service-catalog-manager.tsx`, `bottom-nav.tsx`, `lib/use-manager-today-indexeddb.ts`, `components/manager-data-client-provider.tsx`

**Problem:**

Diverging implementations of same manager screens. PWA has offline layering + view models; app has Next BFF. Catalog/calendar fixes often need two large files.

**Solution:**

After migration slices stabilize, extract shared domain UI into a package (e.g. extend `@repo/ui` or new `@repo/manager-ui`). PWA/pwa supply only routing and data providers at the seam.

**Benefits:**

- **Locality:** appointment/catalog UI exists once
- **Leverage:** one test suite for shared drawers

**Deletion test:** Removing either app's copy **concentrates** in survivor — duplication is load-bearing during migration.

**ADR notes:** None. Coordinate with [`docs/pwa-migration-plan.md`](pwa-migration-plan.md).

---

## Shallow modules (low priority — deletion test: complexity moves, not concentrates)

| Module | Path | Notes |
|--------|------|-------|
| `service-catalog-groups.ts` | `components/services/` | Re-exports `@repo/salon-core` |
| `navigation.ts` | `lib/` | `homePathForRole` always returns `'/today'` |
| Context accessor hooks | `manager-data-client.tsx` | Thin `useContext` wrappers |

---

## Seam inventory (behaviour varies — adapter candidates)

| Seam | Adapters / modes | Key files |
|------|------------------|-----------|
| Persistence | IndexedDB vs localStorage vs live React Query | `manager-data-client.tsx`, `offline-snapshot.ts`, `offline-projection.ts`, `auth.tsx` |
| HTTP | `api.*` vs `DataClient` modules | `api-client.ts`, `use-service-addons.ts`, many call sites |
| API base | PWA `env.apiBaseUrl` + `/api/v1` vs app relative `/api` | `env.ts`, `manager-data-client.tsx` |
| Read path | `useManagerCollection` vs route `useQuery` + idb hydrate | `manager-data-queries.ts` vs `today.tsx` / `calendar.tsx` |
| Role | Manager vs staff on `/today` | `today.tsx` |
| Network | `useNetworkStatus` gates UI and mutations | `network-status.ts`, drawers, `offline-state.tsx` |
| Mutations | `useManagerMutation` vs raw `useMutation` | See candidate #3 |
| Auth session | Online `api.auth.me` vs cached user | `auth.tsx`, `offline-snapshot.ts` |
| Appointment requests | Online-only | `requests.tsx`, ADR-0001/0002 |
| Service worker | Cache vs network | `public/sw.js`, `service-worker-register.tsx` |

---

## Recommended next step

User has not yet picked a candidate. Default grilling order if unspecified:

1. **#1 Offline Projection** — unblocks coherent offline UX across routes
2. **#2 Manager reads** — fixes stale cache bugs with lowest blast radius
3. **#3 Write policy** — depends on clarity from #1 and #2

When user picks a candidate, enter grilling loop per `improve-codebase-architecture` skill step 3. Update `CONTEXT.md` if new terms crystallize. Offer ADR only for load-bearing rejections.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-02 | Initial review from `/improve-codebase-architecture` exploration |
