# Next.js Manager PWA to TanStack Router PWA Migration Plan

Date: 2026-05-26

## Executive Summary

Move the existing manager PWA from the legacy Next.js app in `apps/app` to the fresh React + Vite + TanStack Router app in `apps/pwa` through vertical slices. Do not mutate the legacy app in place, do not depend on Next.js API routes, and do not introduce TanStack Start. The new PWA must use the Hono API as its only backend boundary.

The repo is already well positioned for this migration: `apps/api` contains a real Hono API, `packages/api-client` contains typed client modules for many domains, and `packages/data-client` already owns manager offline projections, IndexedDB persistence, and mutation queue behavior. The main migration risk is not UI portability; it is normalizing the API boundary because legacy UI and `packages/data-client` currently use `/api/*`, while Hono is mounted at `/api/v1/*` and the old Next app bridges the mismatch with rewrites.

Recommended first slice: migrate auth plus `/dashboard`. This proves cookies, Hono base URLs, TanStack Router guards, route loading/error states, shared styling, and deployment assumptions before touching offline-heavy calendar/client workflows.

## Guidance Loaded

- `apps/pwa/AGENTS.md` requires TanStack Intent before substantial work.
- Loaded TanStack Intent skills:
  - `@tanstack/router-core#router-core`
  - `@tanstack/router-core#router-core/auth-and-guards`
  - `@tanstack/router-core#router-core/data-loading`
  - `@tanstack/router-core#router-core/navigation`
  - `@tanstack/router-core#router-core/search-params`
  - `@tanstack/router-core#router-core/path-params`
  - `@tanstack/router-core#router-core/not-found-and-errors`
  - `@tanstack/router-plugin#router-plugin`
- Loaded local project Hono skill at `.agents/skills/hono/SKILL.md`.

Important TanStack implications:

- TanStack Router loaders are client-first. Route loaders must call browser-safe fetch/API clients, not database/server-only modules.
- Auth guards should use `beforeLoad` to protect UI and prevent protected-content flash.
- Hono must still enforce auth and permissions. Router guards are not a security boundary.
- Use router context for auth/API clients; do not call React hooks inside `beforeLoad` or loaders.
- Use `validateSearch` and `loaderDeps` for search-driven pages such as calendar and today.
- Use `router.invalidate()` after route-loader mutations and loader errors.
- Keep the TanStack Router Vite plugin before React in `vite.config.ts`.

## Legacy App Inventory (`apps/app`)

### Routes and Route Groups

Legacy App Router pages:

- `/` from `apps/app/app/page.tsx`
- `/login` from `apps/app/app/login/page.tsx`
- `/signup` from `apps/app/app/signup/page.tsx`
- `/today` from `apps/app/app/(app)/today/page.tsx`
- `/calendar` from `apps/app/app/(app)/calendar/page.tsx`
- `/clients` from `apps/app/app/(app)/clients/page.tsx`
- `/clients/[id]` from `apps/app/app/(app)/clients/[id]/page.tsx`
- `/requests` from `apps/app/app/(app)/requests/page.tsx`
- `/settings` from `apps/app/app/(app)/settings/page.tsx`
- `/dashboard` from `apps/app/app/(app)/dashboard/page.tsx`
- `/retention` from `apps/app/app/(app)/retention/page.tsx`
- `/services` from `apps/app/app/(app)/services/page.tsx`
- `/staff` from `apps/app/app/(app)/staff/page.tsx`
- `/onboarding` from `apps/app/app/(app)/onboarding/page.tsx`
- `/public-page` from `apps/app/app/(app)/public-page/page.tsx`
- `/nav-prototype` exists as a prototype route and should not be migrated unless still intentionally used.

The `(app)` route group is an implementation detail. In TanStack Router, preserve URL paths, not the Next route group.

### Layouts and Navigation Shells

`apps/app/app/layout.tsx` provides:

- RTL Persian document shell.
- Next font (`Vazirmatn`) via `next/font/google`.
- `ThemeProvider` from `next-themes`.
- `InstallPrompt`, `ServiceWorkerRegister`, `Toaster`, and Vercel Analytics.
- PWA metadata and viewport.

`apps/app/app/(app)/layout.tsx` provides the protected app shell:

- `SwrProvider`
- `AuthProvider`
- `AuthGate`
- full-height mobile app layout

`AuthGate` adds:

- onboarding gate for managers
- `ManagerDataClientProvider`
- `ManagerSyncBar`
- `BottomNav`

`BottomNav` role-specific items:

- Manager: `/today`, `/calendar`, `/requests`, `/clients`, `/settings`
- Staff: `/today`, `/calendar`, `/settings`
- Manager pending request badge from `/api/appointment-requests?status=pending`

TanStack target:

- Root route owns global providers and document-level app shell.
- A pathless authenticated layout route should enforce auth with `beforeLoad`.
- A manager pathless layout or per-route `beforeLoad` should enforce manager-only pages.
- Bottom nav should use TanStack `Link` with active states instead of `next/link` and `usePathname`.

### Auth and Session Flows

Current behavior:

- `/api/auth/login` returns `{ user, token }`, sets `session` cookie.
- `/api/auth/signup` creates salon workspace, sets `session` cookie, returns `redirectTo: '/onboarding'`.
- `/api/auth/me` returns `{ user }`.
- `/api/auth/logout` clears session cookie.
- `AuthProvider` caches the session user in localStorage under `aravira-offline-v1:session-user`.
- If `/me` fails while offline, cached user is used.
- Current redirects use `next/navigation` effects and `router.refresh()`.

TanStack target:

- Build a PWA `AuthProvider` that uses `@repo/api-client/auth` against Hono.
- Inject auth into router context.
- Use `beforeLoad` to redirect unauthenticated users to `/login`.
- Use `beforeLoad` or route-level guards for manager-only pages.
- Preserve offline cached session fallback.
- Replace `router.refresh()` with auth state refresh and `router.invalidate()` where route loaders need refetching.

### Data Access Patterns

Current data access is mixed:

- SWR for many route reads.
- Raw `fetch('/api/...', { credentials: 'include' })`.
- `fetchJsonOrThrow` from `apps/app/lib/pwa-client.ts`.
- `@repo/data-client` for manager offline cache, IndexedDB projections, and queued mutations.
- `@repo/api-client` exists but is not yet the main app-wide client.

Important data-client behavior:

- `createDataClient({ persistence: 'indexeddb' })` is created in browser only.
- IndexedDB database name defaults to `aravira-manager-offline`.
- Reads hydrate from server and can fall back to local projections.
- Mutations can queue offline and replay through `sync.processPending()`.
- Sync runs on online, focus, and visibility changes.

TanStack target:

- **Drop SWR in the new PWA.** Standardize on **TanStack Query + TanStack Router loaders together** as the read pattern:
  - Route `loader` calls `queryClient.ensureQueryData(...)` (or `prefetchQuery`) for the data the route needs. This gives loader-driven pending/error UI and SSR-like prefetch.
  - Components use `useQuery`/`useSuspenseQuery` against the same query keys, so revalidation, background refetch, optimistic updates, and cache sharing across routes work natively.
  - After mutations, invalidate query keys via `queryClient.invalidateQueries(...)` and call `router.invalidate()` only when route-level loader deps changed.
  - Rationale: TanStack Query handles caching/refetch better than SWR for our offline + mutation workflows, and pairs natively with TanStack Router. Mixing SWR alongside would mean two cache systems.
- Keep `@repo/data-client` for offline-first manager workflows. Where a route is data-client-backed, the Router loader should kick `data-client` hydration and the component should subscribe to its projections — TanStack Query is for non-data-client reads (auth, dashboard, retention, etc.).
- Make both `@repo/api-client` and `@repo/data-client` work against Hono without relying on Next rewrites.

### Forms and Mutations

Current forms:

- `react-hook-form`
- `@hookform/resolvers/zod`
- Zod schemas from `@repo/salon-core/forms/*`
- UI primitives from `@repo/ui`

Mutation patterns:

- Some mutations use raw fetch.
- Many manager workflows already use `@repo/data-client` and `runMutation`.
- Offline mutation queue covers clients, appointments, business settings, services, staff services, and staff schedule.

TanStack target:

- Preserve form schemas and UX.
- Convert raw fetch mutations to API-client/data-client adapters as routes migrate.
- After mutations, invalidate route loaders or refresh local data-client projections.
- Use TanStack `useBlocker` only where unsaved form navigation blocking is needed.

### PWA, Manifest, and Service Worker

Current PWA behavior:

- `apps/app/app/manifest.ts` generates Persian app manifest with icons, screenshots, shortcuts, RTL/lang, display overrides, colors.
- `apps/app/public/sw.js` is a hand-written service worker.
- Service worker precaches manifest/icons/offline launch page/logo.
- Service worker caches navigations for core app routes.
- Service worker excludes `/api/*` from caching.
- Service worker caches static media.
- Push notification click opens/focuses `/calendar` or payload URL.
- `ServiceWorkerRegister` unregisters service workers and clears caches in development.
- Production update prompt checks Next build ID and prompts reload.
- `InstallPrompt` only renders in production.
- Offline snapshots use localStorage through `pwa-client.ts`.

TanStack/Vite target:

- Copy/adapt assets from `apps/app/public` into `apps/pwa/public`.
- Replace Next generated manifest with static `manifest.webmanifest` or generated Vite build artifact.
- Register a service worker from the Vite app, not Next.
- Replace Next build-id update detection with Vite asset manifest/version strategy.
- Keep API requests out of service worker caching.
- Preserve offline route fallback and push notification behavior.
- Ensure SPA fallback works for deep links under Vite/static hosting.

### Environment Variables

Legacy app:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_PWA_ASSET_VERSION`
- `USE_HONO_API`
- `HONO_API_URL`

Hono API:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- Optional push env:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
- Optional flags:
  - `ENABLE_NOTIFICATION_TEST`
  - `APP_ENV`
  - `VERCEL_ENV`
  - `DISABLE_REQUEST_LOG`

PWA target:

- Introduce Vite-prefixed public values:
  - `VITE_API_BASE_URL` — e.g. `https://api.saloora.beauty` in prod, `http://localhost:<honoPort>` in dev. Client appends `/api/v1/...`.
  - `VITE_APP_URL` — e.g. `https://app.saloora.beauty`.
  - `VITE_WEB_URL`
  - `VITE_VAPID_PUBLIC_KEY` if the client reads it directly, though current push config can come from Hono.
  - `VITE_PWA_ASSET_VERSION`
- Hono env additions to match:
  - `CORS_ORIGINS` must include `https://app.saloora.beauty` and `http://localhost:5173`, with `credentials: true`.
  - Session cookie set with `SameSite=None; Secure; HttpOnly`, and `Domain=.saloora.beauty` if cookie sharing across `app`/`api` subdomains is desired.
- Server-only secrets remain in `apps/api`/runtime env, never in `apps/pwa`.

### Shared Dependencies

Legacy app depends on:

- `@repo/ui`
- `@repo/salon-core`
- `@repo/brand-tokens`
- `@repo/data-client`
- `@repo/auth`
- `@repo/database`
- `@repo/notifications`
- `@fullcalendar/*`
- `swr`
- `react-hook-form`
- `@hookform/resolvers`
- `zod`
- `next-themes`
- `web-push`

PWA should depend on client-safe packages only:

- keep/add: `@repo/ui`, `@repo/salon-core`, `@repo/brand-tokens`, `@repo/data-client`, `@repo/api-client`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@fullcalendar/*`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, `lucide-react`.
- do NOT add `swr`. Replaced by TanStack Query (see Data Access Patterns).
- avoid in browser app: `@repo/database`, server-side `@repo/auth` modules, `@repo/notifications`, `web-push`, Next packages.
- replace `next-themes` with a small Vite-safe theme provider or another existing client-safe package if already approved.

### Legacy Next API Behavior to Replace with Hono

Treat all legacy API route files under `apps/app/app/api` as reference only. Do not import them or route the PWA through them.

Already covered by Hono:

- auth
- clients
- appointments
- appointment availability
- appointment requests approve/reject/list
- dashboard
- onboarding
- retention
- service categories/families/addons/services/combo components/import starter templates
- staff list/create/schedule/services/booking availability
- settings/business
- notification preferences
- notifications
- push
- public salon/availability/appointment request submit/view/cancel
- today

Known gaps:

- Manager public-page settings endpoint currently exists as legacy `/api/salon-public-settings`; add a Hono equivalent.
- `packages/api-client` lacks modules for appointment requests, manager public settings, public customer booking, and push.
- `packages/data-client` hardcodes `/api/*` paths and needs a Hono path strategy.

## Destination App Inventory (`apps/pwa`)

Current setup:

- React + Vite + TanStack Router.
- No TanStack Start.
- `apps/pwa/src/routes/__root.tsx` renders `Outlet` and TanStack devtools.
- `apps/pwa/src/routes/index.tsx` is starter copy and says "TanStack Start"; replace in first implementation slice.
- `apps/pwa/src/router.tsx` exports `getRouter()`, but `apps/pwa/src/main.tsx` creates a second router directly. Consolidate this before adding routes.
- `apps/pwa/vite.config.ts` includes devtools, Tailwind, TanStack Router, and React. TanStack Router plugin appears before React, which matches Intent guidance.
- `apps/pwa/public/manifest.json` is starter manifest and should be replaced.
- No Hono API client setup exists.
- No PWA service worker setup exists.
- No app shell, auth provider, theme provider, toast provider, or shared UI styles are wired yet.

Destination setup TODOs:

- Import `@repo/ui/styles.css` from the PWA root styles or root route.
- Add workspace package dependencies to `apps/pwa/package.json` (incl. `@tanstack/react-query`).
- Add env parser for `VITE_API_BASE_URL` and related public values.
- Add API client factory with `credentials: 'include'` and base URL `${VITE_API_BASE_URL}/api/v1`.
- Add a single `QueryClient` instance and inject into router context alongside the API client and auth.
- Add `ManagerDataClientProvider` equivalent with configurable Hono base URL.
- Replace starter manifest and assets.
- Add route hierarchy and guards.

## Migration Phases

### Phase 0: Boundary Decisions

**Resolved (2026-05-26):**

- **Production topology:** separate origins.
  - PWA: `https://app.saloora.beauty`
  - Hono API: `https://api.saloora.beauty`
- **API URL strategy:** Direct Hono. PWA calls `${VITE_API_BASE_URL}/api/v1/*` directly. No reverse-proxy rewrite of `/api/*` in front of the PWA.
- **Cookies:** session cookie is set with `SameSite=None; Secure; HttpOnly`, no `Domain` attribute (host-only on `api.saloora.beauty`). Implemented in `apps/api/src/routes/auth.ts` — `Secure` works on `http://localhost` because browsers treat localhost as a secure context.
- **CORS:** Hono `CORS_ORIGINS` must include `https://app.saloora.beauty` (prod) and `http://localhost:5173` (dev) with `credentials: true`. Preflight must allow `Content-Type` and any auth headers actually sent.
- **Dev environment:** mirror prod cross-origin topology rather than using a Vite same-origin proxy. Set `VITE_API_BASE_URL=http://localhost:<honoPort>` and run Hono with dev CORS allowing `http://localhost:5173`. Rationale: catches cookie/CORS regressions in dev instead of in production. A same-origin Vite proxy would hide `SameSite=None`/`Secure` cookie issues until deploy.
- **Data-client base path:** `@repo/data-client` gets a configurable base URL (default `${VITE_API_BASE_URL}/api/v1`) so `/api/*` hardcoding is removed without depending on Next rewrites.
- **`@repo/api-client` endpoints:** point at Hono `/api/v1/*` directly (no logical `/api/*` indirection).

Acceptance criteria:

- `@repo/api-client` can call Hono from `apps/pwa` cross-origin with credentials.
- `@repo/data-client` calls Hono without Next rewrites.
- Cookie auth works in local dev (cross-origin localhost) and prod topology (`app` ↔ `api` on `.saloora.beauty`).
- Hono remains the only backend boundary.

### Phase 1: PWA Foundation and Auth

Work:

- Consolidate PWA router creation.
- Add root providers: auth, API client, optional SWR, theme, toast.
- Add pathless authenticated layout route.
- Add manager-only guard helper.
- Migrate `/`, `/login`, `/signup`.
- Preserve cached session fallback.
- Preserve onboarding gate behavior.

Acceptance criteria:

- Unauthenticated protected routes redirect to `/login` before rendering protected UI.
- Login/signup use Hono auth.
- Logout clears session and local cached user.
- `/` redirects to `/today` for authenticated users.
- Staff attempting manager-only routes lands at `/today` or sees the existing access behavior.

### Phase 2: First Read Slice

Recommended route: `/dashboard`.

Why:

- Manager-only.
- Read-heavy.
- Uses Hono coverage that already exists.
- Has straightforward loading state.
- Proves route loaders, API client, auth, and bottom nav without offline complexity.

Acceptance criteria:

- Dashboard data loads from Hono.
- Loading and error states are explicit.
- Refresh semantics are preserved through loader stale time, invalidation, or retained SWR.
- Staff cannot access it.

### Phase 3: Offline/Data-Client Foundation

Work:

- Migrate `ManagerDataClientProvider`, `ManagerSyncBar`, and offline snapshot helpers into PWA-safe modules.
- Replace `next/link` in sync review links with TanStack `Link`.
- Configure data-client base path.
- Verify IndexedDB database compatibility.

Acceptance criteria:

- Existing offline queue state is visible in the new PWA, or an intentional migration/reset is documented.
- Pending mutations process on online/focus/visible.
- Review, retry, discard actions work.

### Phase 4: Manager CRUD Slices

Suggested order:

1. `/retention`
2. `/clients`
3. `/clients/$id`
4. `/services`
5. `/staff`
6. `/settings`

Rationale:

- Retention is small and proves mutation/invalidation.
- Clients introduces offline list/detail and drawer workflows.
- Services and staff exercise more complex form/drawer dependencies.
- Settings contains theme, push, business settings, metrics, and logout, so it benefits from prior foundations.

### Phase 5: Calendar and Today

Work:

- Migrate `/calendar` with search param validation for `date`, `clientId`, `appointmentId`.
- Migrate appointment drawers, detail drawer, availability drawer, staff filter, FullCalendar wrapper.
- Migrate `/today` manager/staff variants and next-open-slot logic.
- Preserve status update permissions and offline behavior.

Acceptance criteria:

- Calendar range loading and navigation match legacy behavior.
- Deep links with search params open the same UX states.
- Appointment create/edit/delete/status flows use Hono/data-client only.
- Offline projections behave the same for previously hydrated ranges.

### Phase 6: Requests

Work:

- Add `@repo/api-client` appointment request module.
- Migrate `/requests`.

**Out of initial scope:** `/public-page` is deferred. The legacy `/api/salon-public-settings` endpoint has no Hono parity yet. Before migrating, audit *all* Next API routes against Hono for parity (request/response shape, validation messages, status codes) and resolve any gaps in `apps/api` first. Track the parity audit as a separate task; once resolved, schedule `/public-page` in a follow-up phase.

Acceptance criteria:

- Pending request badge works in bottom nav.
- Requests list by status, approve, and reject match legacy behavior and response shape.

### Phase 7: PWA Hardening

Work:

- Replace starter PWA manifest.
- Copy/adapt icons, screenshots, splash assets, offline page, and service worker.
- Register service worker only under intended production/dev policy.
- Replace Next build-id update check with Vite/PWA asset versioning.
- Verify push notifications.
- Verify install prompt.
- Verify deep-link SPA fallback.

Acceptance criteria:

- App installs with correct Persian/RTL manifest metadata.
- Core routes work offline when previously cached.
- API calls are not cached by the service worker.
- Push notification click focuses/opens the relevant route.
- Updates prompt users and reload cleanly.

## Route-by-Route Migration Plan

| Route | Suggested order | Dependencies | Hono endpoints needed | API-client/data-client work | Risks and unknowns | Acceptance criteria |
| --- | ---: | --- | --- | --- | --- | --- |
| `/` | 1 | Auth context, router guards | `GET /api/v1/auth/me` | Auth API | Replacing server redirect with client guard | Redirects to `/today` when authenticated, `/login` otherwise |
| `/login` | 1 | Auth form, session snapshot | `POST /api/v1/auth/login` | Auth API | Cookie behavior across origins | Login sets cookie, caches user, redirects to `/today`, errors match legacy |
| `/signup` | 1 | Auth form, slug helper | `POST /api/v1/auth/signup` | Auth API | Redirect and cookie behavior | Creates salon, sets session, redirects to `/onboarding` |
| Protected shell | 1 | Auth provider, onboarding status, bottom nav | `GET /api/v1/onboarding` | Onboarding API | Avoiding protected content flash | Protected UI only renders after auth/onboarding guard decisions |
| `/dashboard` | 2 | Manager guard, loading/error state | `GET /api/v1/dashboard` | Dashboard API | Refresh interval vs loader stale time | Metrics render, manager-only guard works |
| `/retention` | 3 | Manager guard, links, mutation invalidation | `GET /api/v1/retention`, `PATCH /api/v1/retention/:id` | Retention API | Empty/error handling is sparse in legacy | List, empty state, reviewed/dismissed mutations work |
| `/clients` | 4 | Data-client, client drawer, retention side data | `GET/POST /api/v1/clients`, `GET /api/v1/retention` | Data-client base path, clients API | Offline projection parity | Search/filter, create/edit, offline fallback, loading/empty states work |
| `/clients/$id` | 5 | Path params, data-client summary cache | `GET/PATCH /api/v1/clients/:id`, `GET /api/v1/clients/:id/summary`, `POST /api/v1/clients/:id/follow-ups` | Clients API | Not-found handling | Detail and history render, follow-up actions work |
| `/services` | 6 | Service catalog manager, addon manager | Services/category/family/addon Hono routes | Data-client and services API | Complex local state and starter import flag | CRUD, combo components, addons, starter import match legacy |
| `/staff` | 7 | Staff drawer, service drawer, schedule drawer | Staff Hono routes | Data-client and staff API | Schedule validation and manager-only behavior | Staff create, service assignment, schedule, availability work |
| `/settings` | 8 | Theme provider, push settings, metrics, business hours | `GET/PATCH /api/v1/settings/business`, notification prefs, push, dashboard | Add push API; maybe retain dashboard API | Replace `next-themes`; push support depends on SW scope | Logout, theme, alerts, business hours, staff push settings work |
| `/calendar` | 9 | FullCalendar, query params, appointment drawers, data-client | Appointment/staff/services/clients/settings Hono routes | Data-client base path; appointments API | Search param parity, offline range cache, FullCalendar deps | Deep links, range loads, create/edit/delete/status, offline projections work |
| `/today` | 10 | Today hooks, appointment detail drawer, role variants | Today/appointments/staff/services/clients Hono routes | Data-client today module | Staff vs manager behavior, polling/time updates | Manager/staff today views and status updates match legacy |
| `/requests` | 11 | Manager guard, bottom nav badge, dialogs | Appointment request Hono routes | Add appointment requests API-client module | Approve/reject response/error parity | Tabs, counts, approve/reject, badge work |
| `/public-page` | Deferred | Manager public settings editor | Add manager public settings Hono routes | Add public settings API-client module | **No Hono parity for `/api/salon-public-settings` — deferred until full Next↔Hono parity audit completes** | Load/save/copy link/preview behavior works through Hono |
| `/nav-prototype` | Omit | None | None | None | Prototype route may be obsolete | Do not migrate unless requested |

## Required Hono and API-Client Work

### Hono

- Add manager public settings endpoints equivalent to legacy `/api/salon-public-settings`:
  - `GET /api/v1/salon-public-settings` or a clearer `/api/v1/public/settings`
  - `PUT /api/v1/salon-public-settings` or equivalent
- Preserve legacy response shape for public-page UI unless the UI is intentionally adapted.
- Keep all auth/tenant permission checks in Hono middleware/handlers.
- Confirm appointment request, appointment, push, notification, and public endpoints match legacy validation messages and status codes where UI depends on them.

### `packages/api-client`

Add modules for:

- appointment requests:
  - list by status
  - approve
  - reject
- manager public settings:
  - get
  - update
- public booking/salon:
  - get public salon
  - public availability
  - submit appointment request
  - view/cancel request by token
- push:
  - config
  - subscribe
  - unsubscribe

Also decide whether `endpoints` should represent Hono `/api/v1/*` directly or logical `/api/*` paths consumed through a proxy.

### `packages/data-client`

- Make request base URL configurable (default `${VITE_API_BASE_URL}/api/v1`).
- Avoid hardcoded Next `/api/*` dependency in replay and module methods.
- Preserve credentials include behavior for cookie sessions.
- **Keep IndexedDB DB name `aravira-manager-offline` and the `aravira-offline-v1:session-user` localStorage key unchanged**, so existing installed users keep their offline queue and cached session when the new PWA replaces the Next app. If a schema-incompatible change is required later, add a versioned migration; do not silently rename.

## Things That Cannot Migrate 1:1

- Next route groups such as `(app)` have no URL meaning; use TanStack pathless layout routes instead.
- Next `redirect()` from server page must become TanStack `beforeLoad` redirect.
- `next/link` and `next/navigation` must become TanStack `Link`, `useNavigate`, route APIs, and search/params helpers.
- `router.refresh()` must become auth refresh, `router.invalidate()`, or data-client/SWR revalidation.
- Next API route handlers must be replaced by Hono endpoints and API clients.
- Next middleware CORS must move to Hono CORS and/or deployment proxy config.
- Next metadata, viewport, manifest, and `head.tsx` must become Vite `index.html`, static manifest, or explicit head management.
- `next/font/google` must be replaced by a Vite-compatible font loading strategy.
- `next-themes` should be replaced with a Vite-safe theme provider.
- Vercel Analytics import from `@vercel/analytics/next` cannot be reused directly.
- Next service worker build-id update checks must be replaced with Vite build/version checks.
- Server-only packages (`@repo/database`, server-side `@repo/auth`, `@repo/notifications`, `web-push`) must not enter the browser bundle.

## Durable Context Updates to Consider

Update `apps/pwa/AGENTS.md` or add a root migration note after the first implementation slice with:

- Stack: React + Vite + TanStack Router, not TanStack Start.
- Backend boundary: Hono only.
- Route loaders are client-first and must use browser-safe API clients.
- Do not import from legacy Next API routes.
- API base URL and cookie/CORS requirements.
- Offline data is owned by `@repo/data-client`.
- PWA service worker must not cache API requests.
- Shared UI must follow `packages/ui/AGENTS.md` touch target rules.

## Risks

- Cross-origin cookie auth can fail if `CORS_ORIGINS`, credentials, cookie `SameSite`, and production domains are not aligned.
- Service worker cache rules need careful adaptation from Next document caching to Vite SPA fallback.
- `packages/data-client` currently assumes `/api/*`, so Hono path mapping must be solved before offline workflows migrate.
- `apps/pwa` currently uses React 19.2 while shared packages pin React 19.1. Align versions before broad component migration.
- Missing PWA public assets in `apps/pwa` will make manifest/install behavior incomplete until copied/adapted.
- FullCalendar and form dependencies are not yet in `apps/pwa`.
- Offline auth fallback can show cached user while server session is expired; keep the sync auth-blocked UX.
- Manager public settings endpoint coverage is incomplete in Hono today.

## Resolved Decisions (2026-05-26)

- **Origins:** separate. `app.saloora.beauty` (PWA) and `api.saloora.beauty` (Hono). Direct cross-origin calls with credentialed cookies.
- **Dev environment:** mirror prod cross-origin via `VITE_API_BASE_URL=http://localhost:<honoPort>` + Hono CORS for `http://localhost:5173`. No Vite same-origin proxy (would hide `SameSite=None`/`Secure` issues).
- **Read pattern:** TanStack Query + TanStack Router loaders, used together. No SWR in the new PWA.
- **IndexedDB / localStorage keys:** reuse existing keys (`aravira-manager-offline`, `aravira-offline-v1:session-user`) so installed users keep offline state.
- **`/public-page`:** deferred. Run a full Next↔Hono parity audit first; resolve all gaps in `apps/api`, then schedule.
- **Hosting / SPA fallback:** out of scope for this plan (revisit in Phase 7 when deploying).

## Phase 0/1 — Shipped (2026-05-26)

Foundation slice landed and verified end-to-end against Hono on localhost.

**Backend (`apps/api`):**
- `routes/auth.ts` — session cookie now `HttpOnly; Secure; SameSite=None` (was `Lax`, secure only in prod). Logout `deleteCookie` mirrors the same attributes so the browser will overwrite the prior cookie.

**Shared (`packages/api-client`):**
- `endpoints.ts` — all paths rewritten to `/api/v1/*` (Hono base). Legacy `apps/app` uses raw fetch, so this is safe.

**PWA (`apps/pwa`):**
- Deps: added `@repo/ui`, `@repo/salon-core`, `@repo/brand-tokens`, `@repo/api-client`, `@tanstack/react-query(+devtools)`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`. Pinned `react`/`react-dom` to 19.1.0 to match `@repo/ui`.
- `tsconfig.json` — `@repo/*` path aliases.
- `index.html` — `lang="fa" dir="rtl"`, Persian title, viewport-fit=cover.
- `src/env.ts` — `VITE_API_BASE_URL` parser (default `http://localhost:3002`).
- `src/lib/api-client.ts` — `createApiClient({ baseUrl: VITE_API_BASE_URL, credentials: 'include' })`.
- `src/lib/offline-snapshot.ts` — ported localStorage helpers; **DB/key names preserved** (`aravira-offline-v1:session-user`).
- `src/lib/auth.tsx` — `AuthProvider` over TanStack Query. Hydrates from cache, falls back to cache on network error, clears on 401. `registerAuthQueryDefaults` makes `ensureQueryData` usable in `beforeLoad` outside React.
- `src/router.tsx` — single `getRouter({ queryClient })` factory with router context type. Removed duplicate router creation from `main.tsx`.
- Routes: `__root` (createRootRouteWithContext), `/` (redirect), `/login`, `/signup`, `/_authed` (pathless auth guard), `/_authed/today` (placeholder), `/_authed/dashboard` (manager-only, Router loader + Query refetch), `/_authed/settings` (logout).
- `src/components/bottom-nav.tsx` — TanStack `Link` + `useRouterState`, role-based items.

**Verified:**
- `pnpm exec tsc --noEmit` → exit 0
- `pnpm build` → succeeds, code-split chunks generated
- Hono login → `Set-Cookie: session=...; Secure; HttpOnly; SameSite=None`, CORS headers present
- Cookie round-trips through `/api/v1/auth/me` and `/api/v1/dashboard` from `Origin: http://localhost:3001`
- Logout clears cookie; `/me` then returns 401

**Deferred to later phases:**
- Theme provider (replace `next-themes`)
- Toast provider (sonner)
- Onboarding gate
- PWA service worker / manifest / install prompt / push
- Vazirmatn font loading (currently system fonts — Iran VPS may need self-hosted font; do not rely on Google Fonts)

## Phase 2 — Shipped (2026-05-26)

`/_authed/dashboard` ships full UI parity with `apps/app/app/(app)/dashboard/page.tsx`:

- Router `loader` calls `queryClient.ensureQueryData` against `api.dashboard.get`.
- `useQuery` with `staleTime: 60_000` + `refetchInterval: 60_000` (matches legacy SWR `refreshInterval`).
- Explicit `pendingComponent` (`Spinner`) and `errorComponent`.
- `beforeLoad` enforces manager-only; non-managers redirect to `/today`.
- Cosmetic delta: PWA uses `Spinner` while legacy uses `DashboardSkeleton`. Not blocking.

## Phase 3 — Shipped (2026-05-26)

**Shared (`packages/data-client`):**
- `adapters/http/fetch-http-transport.ts` — added `apiPrefix` option (default `'/api'`). When set, rewrites the leading `/api` in caller-supplied module paths. Legacy `apps/app` keeps default; PWA passes `'/api/v1'` to target Hono directly. Module callsites unchanged, so legacy + tests unchanged.
- `create-data-client.ts` — plumbs `apiPrefix` through `CreateDataClientConfig`.

**PWA (`apps/pwa`):**
- Deps: added `@repo/data-client` workspace dep.
- `src/lib/manager-data-client.tsx` — ported `ManagerDataClientProvider` + hooks (`useManagerDataClient`, `useManagerOfflineDataEpoch`, `useBumpOfflineData`). `createDataClient({ persistence: 'indexeddb', basePath: env.apiBaseUrl, apiPrefix: '/api/v1' })`. **IndexedDB DB name `aravira-manager-offline` preserved** (data-client default) so installed users keep their offline queue.
- `src/components/manager-sync-bar.tsx` — ported `ManagerSyncBar`. Replaces `next/link` with TanStack `Link to=...`. Uses PWA `useAuth` from `#/lib/auth`.
- `src/routes/_authed.tsx` — wraps the authenticated shell in `ManagerDataClientProvider` and renders `ManagerSyncBar` above `<main>` (between sync bar and `BottomNav`).

**Verified:**
- `pnpm test` in `packages/data-client` → 20 passed (apiPrefix default preserves legacy behavior)
- `pnpm exec tsc --noEmit` in `apps/pwa` → only the pre-existing `appointments-module.ts` TS6133 warning (unchanged from main)
- `pnpm build` in `apps/pwa` → succeeds; sync UI lives in the `_authed` chunk

**Note on existing offline state:** Installed legacy users hit `apps/app` at `aravira-manager-offline`. Both apps now write to the same DB. When a user moves to the PWA, queued mutations replay against Hono via the `/api/v1` rewrite — same endpoints, just a different prefix. No migration needed.

## Phase 4 — In Progress

### `/clients` — Shipped (2026-05-26)

List page with offline-first IDB hydration, retention follow-up filter cross-query, and inline create/edit drawer (`FormSheet` + vaul).

**Deps added (`apps/pwa`):**
- `vaul` (for `FormSheet`).
- `<Toaster />` from `@repo/ui/toaster` rendered in `__root` (so `runMutation` toasts work).

**New PWA modules ported from `apps/app`:**
- `src/lib/network-status.ts` — `useNetworkStatus`, `formatSnapshotAge`.
- `src/lib/use-keyboard-inset.ts` — keyboard inset CSS var for `FormSheet` footer.
- `src/lib/use-dismiss-guard.tsx` — unsaved-changes confirm dialog.
- `src/lib/run-mutation.ts` — toast wrapper around mutation; preserves `DataClientHttpError.message`.
- `src/lib/use-clients-indexeddb.ts` — IDB list source (`hydrateListFromServer` + `list` + `listLastSyncedAt`).
- `src/components/form-sheet.tsx` — vaul-based full-screen sheet.
- `src/components/offline-state.tsx` — `NetworkStatusBanner`, `OfflineStateCard`.
- `src/components/clients/{client-visuals,clients-skeleton,client-drawer}.tsx`.

**Route:**
- `src/routes/_authed/clients.tsx` — manager-only guard; Router `loader` → `ensureQueryData(['clients'])`; `useQuery` shares the key; retention `useQuery(['retention'])` reused from `/retention`'s key; IDB hook layered on top so offline reads work after first hydrate. Drawer success path invalidates `['clients']`.
- `api-client.ts` — added `clients: createClientsApi(apiClient)`.
- `bottom-nav.tsx` — added `/clients` manager item (Users icon); `/retention` folded under settings prefix match.

**Parity deviations:**
- Row click opens edit drawer in place (legacy links to `/clients/$id`). Will revert when `/clients/$id` ships in the next slice.
- Drawer's raw-fetch fallback path now uses `api.clients.create/update` (cross-origin Hono) instead of legacy `/api/clients`; data-client offline path is unchanged. Error message preservation is weaker (`api-client` errors don't expose status codes the same way), but `DataClientHttpError` still flows through `runMutation`.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning
- `pnpm build` → succeeds; clients chunk 49.9 KB, form-sheet code lands in clients chunk

### `/retention` — Shipped (2026-05-26)

**PWA (`apps/pwa`):**
- `src/lib/api-client.ts` — added `retention: createRetentionApi(apiClient)`.
- `src/routes/_authed/retention.tsx` — manager-only (`beforeLoad` redirects non-managers to `/today`). Router `loader` calls `queryClient.ensureQueryData` against `api.retention.list`. `useQuery` shares the `['retention']` key; `useMutation` wraps `api.retention.updateStatus` and invalidates the same key on success. `busyId` derives from `useMutation`'s `isPending`+`variables`. Header uses `useNavigate` back to `/settings`.
- Unmigrated outbound links (`/calendar?clientId=...`, `/clients/$id`) use plain `<a>` until those routes migrate — full reload is acceptable since those routes do not yet exist in the PWA either.

**Pattern established for the rest of Phase 4:** Router loader (`ensureQueryData`) + `useQuery` (shared key, `initialData` from loader) + `useMutation` (invalidates the same key on success). Manager guard via `beforeLoad` using router context's `user`. Explicit `pendingComponent`/`errorComponent`.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning
- `pnpm build` → succeeds; retention chunk emitted

## Recommended First Implementation Slice

Build the smallest useful vertical slice:

1. Normalize Hono API base URL/path strategy for `apps/pwa`.
2. Add PWA auth provider and API client factory.
3. Consolidate TanStack router creation.
4. Add root/app/authenticated layout routes.
5. Migrate `/`, `/login`, `/signup`.
6. Migrate `/dashboard`.
7. Add bottom nav shell with manager/staff items.
8. Verify with local Hono API and browser navigation.

Definition of done:

- No code is imported from legacy Next API routes.
- Hono is the only backend boundary.
- Login/signup/logout/me work through Hono.
- Protected route guard prevents UI flash.
- Dashboard loads from Hono and handles loading/error/empty states.
- The legacy Next app remains untouched.
