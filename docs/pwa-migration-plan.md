# Next.js Manager PWA to TanStack Router PWA Migration Plan

Date: 2026-05-26

## Executive Summary

Move the existing manager PWA from the legacy Next.js app in `retired manager app` to the fresh React + Vite + TanStack Router app in `apps/pwa` through vertical slices. Do not mutate the legacy app in place, do not depend on Next.js API routes, and do not introduce TanStack Start. The new PWA must use the Hono API as its only backend boundary.

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

## Legacy App Inventory (`retired manager app`)

### Routes and Route Groups

Legacy App Router pages:

- `/` from `retired manager app route page.tsx`
- `/login` from `retired manager app route login/page.tsx`
- `/signup` from `retired manager app route signup/page.tsx`
- `/today` from `retired manager app route (app)/today/page.tsx`
- `/calendar` from `retired manager app route (app)/calendar/page.tsx`
- `/clients` from `retired manager app route (app)/clients/page.tsx`
- `/clients/[id]` from `retired manager app route (app)/clients/[id]/page.tsx`
- `/requests` from `retired manager app route (app)/requests/page.tsx`
- `/settings` from `retired manager app route (app)/settings/page.tsx`
- `/dashboard` from `retired manager app route (app)/dashboard/page.tsx`
- `/retention` from `retired manager app route (app)/retention/page.tsx`
- `/services` from `retired manager app route (app)/services/page.tsx`
- `/staff` from `retired manager app route (app)/staff/page.tsx`
- `/onboarding` from `retired manager app route (app)/onboarding/page.tsx`
- `/public-page` from `retired manager app route (app)/public-page/page.tsx`
- `/nav-prototype` exists as a prototype route and should not be migrated unless still intentionally used.

The `(app)` route group is an implementation detail. In TanStack Router, preserve URL paths, not the Next route group.

### Layouts and Navigation Shells

`retired manager app route layout.tsx` provides:

- RTL Persian document shell.
- Next font (`Vazirmatn`) via `next/font/google`.
- `ThemeProvider` from `next-themes`.
- `InstallPrompt`, `ServiceWorkerRegister`, `Toaster`, and Vercel Analytics.
- PWA metadata and viewport.

`retired manager app route (app)/layout.tsx` provides the protected app shell:

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
- `AuthProvider` caches the session user in localStorage under `saluna-offline-v1:session-user`.
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
- `fetchJsonOrThrow` from `apps/pwa/src/lib/pwa-client.ts`.
- `@repo/data-client` for manager offline cache, IndexedDB projections, and queued mutations.
- `@repo/api-client` exists but is not yet the main app-wide client.

Important data-client behavior:

- `createDataClient({ persistence: 'indexeddb' })` is created in browser only.
- IndexedDB database name defaults to `saluna-manager-offline`.
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

- `retired manager app route manifest.ts` generates Persian app manifest with icons, screenshots, shortcuts, RTL/lang, display overrides, colors.
- `apps/pwa/public/sw.js` is a hand-written service worker.
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

- Copy/adapt assets from `apps/pwa/public` into `apps/pwa/public`.
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
  - `VITE_API_BASE_URL` — e.g. `https://api.saluna.ir` in prod, `http://localhost:<honoPort>` in dev. Client appends `/api/v1/...`.
  - `VITE_APP_URL` — e.g. `https://pwa.saluna.ir`.
  - `VITE_WEB_URL`
  - `VITE_VAPID_PUBLIC_KEY` if the client reads it directly, though current push config can come from Hono.
  - `VITE_PWA_ASSET_VERSION`
- Hono env additions to match:
  - `CORS_ORIGINS` must include `https://pwa.saluna.ir` and `http://localhost:5173`, with `credentials: true`.
  - Session cookie set with `SameSite=None; Secure; HttpOnly`, and `Domain=.saluna.ir` if cookie sharing across `app`/`api` subdomains is desired.
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

Treat all legacy API route files under `retired Next API routes` as reference only. Do not import them or route the PWA through them.

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
  - PWA: `https://pwa.saluna.ir`
  - Hono API: `https://api.saluna.ir`
- **API URL strategy:** Direct Hono. PWA calls `${VITE_API_BASE_URL}/api/v1/*` directly. No reverse-proxy rewrite of `/api/*` in front of the PWA.
- **Cookies:** session cookie is set with `SameSite=None; Secure; HttpOnly`, no `Domain` attribute (host-only on `api.saluna.ir`). Implemented in `apps/api/src/routes/auth.ts` — `Secure` works on `http://localhost` because browsers treat localhost as a secure context.
- **CORS:** Hono `CORS_ORIGINS` must include `https://pwa.saluna.ir` (prod) and `http://localhost:5173` (dev) with `credentials: true`. Preflight must allow `Content-Type` and any auth headers actually sent.
- **Dev environment:** mirror prod cross-origin topology rather than using a Vite same-origin proxy. Set `VITE_API_BASE_URL=http://localhost:<honoPort>` and run Hono with dev CORS allowing `http://localhost:5173`. Rationale: catches cookie/CORS regressions in dev instead of in production. A same-origin Vite proxy would hide `SameSite=None`/`Secure` cookie issues until deploy.
- **Data-client base path:** `@repo/data-client` gets a configurable base URL (default `${VITE_API_BASE_URL}/api/v1`) so `/api/*` hardcoding is removed without depending on Next rewrites.
- **`@repo/api-client` endpoints:** point at Hono `/api/v1/*` directly (no logical `/api/*` indirection).

Acceptance criteria:

- `@repo/api-client` can call Hono from `apps/pwa` cross-origin with credentials.
- `@repo/data-client` calls Hono without Next rewrites.
- Cookie auth works in local dev (cross-origin localhost) and prod topology (`app` ↔ `api` on `.saluna.ir`).
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
- **Keep IndexedDB DB name `saluna-manager-offline` and the `saluna-offline-v1:session-user` localStorage key unchanged**, so existing installed users keep their offline queue and cached session when the new PWA replaces the Next app. If a schema-incompatible change is required later, add a versioned migration; do not silently rename.

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

- **Origins:** separate. `app.saluna.ir` (PWA) and `api.saluna.ir` (Hono). Direct cross-origin calls with credentialed cookies.
- **Dev environment:** mirror prod cross-origin via `VITE_API_BASE_URL=http://localhost:<honoPort>` + Hono CORS for `http://localhost:5173`. No Vite same-origin proxy (would hide `SameSite=None`/`Secure` issues).
- **Read pattern:** TanStack Query + TanStack Router loaders, used together. No SWR in the new PWA.
- **IndexedDB / localStorage keys:** reuse existing keys (`saluna-manager-offline`, `saluna-offline-v1:session-user`) so installed users keep offline state.
- **`/public-page`:** deferred. Run a full Next↔Hono parity audit first; resolve all gaps in `apps/api`, then schedule.
- **Hosting / SPA fallback:** out of scope for this plan (revisit in Phase 7 when deploying).

## Phase 0/1 — Shipped (2026-05-26)

Foundation slice landed and verified end-to-end against Hono on localhost.

**Backend (`apps/api`):**
- `routes/auth.ts` — session cookie now `HttpOnly; Secure; SameSite=None` (was `Lax`, secure only in prod). Logout `deleteCookie` mirrors the same attributes so the browser will overwrite the prior cookie.

**Shared (`packages/api-client`):**
- `endpoints.ts` — all paths rewritten to `/api/v1/*` (Hono base). Legacy `retired manager app` uses raw fetch, so this is safe.

**PWA (`apps/pwa`):**
- Deps: added `@repo/ui`, `@repo/salon-core`, `@repo/brand-tokens`, `@repo/api-client`, `@tanstack/react-query(+devtools)`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`. Pinned `react`/`react-dom` to 19.1.0 to match `@repo/ui`.
- `tsconfig.json` — `@repo/*` path aliases.
- `index.html` — `lang="fa" dir="rtl"`, Persian title, viewport-fit=cover.
- `src/env.ts` — `VITE_API_BASE_URL` parser (default `http://localhost:3002`).
- `src/lib/api-client.ts` — `createApiClient({ baseUrl: VITE_API_BASE_URL, credentials: 'include' })`.
- `src/lib/offline-snapshot.ts` — ported localStorage helpers; **DB/key names preserved** (`saluna-offline-v1:session-user`).
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

`/_authed/dashboard` ships full UI parity with `retired manager app route (app)/dashboard/page.tsx`:

- Router `loader` calls `queryClient.ensureQueryData` against `api.dashboard.get`.
- `useQuery` with `staleTime: 60_000` + `refetchInterval: 60_000` (matches legacy SWR `refreshInterval`).
- Explicit `pendingComponent` (`Spinner`) and `errorComponent`.
- `beforeLoad` enforces manager-only; non-managers redirect to `/today`.
- Cosmetic delta: PWA uses `Spinner` while legacy uses `DashboardSkeleton`. Not blocking.

## Phase 3 — Shipped (2026-05-26)

**Shared (`packages/data-client`):**
- `adapters/http/fetch-http-transport.ts` — added `apiPrefix` option (default `'/api'`). When set, rewrites the leading `/api` in caller-supplied module paths. Legacy `retired manager app` keeps default; PWA passes `'/api/v1'` to target Hono directly. Module callsites unchanged, so legacy + tests unchanged.
- `create-data-client.ts` — plumbs `apiPrefix` through `CreateDataClientConfig`.

**PWA (`apps/pwa`):**
- Deps: added `@repo/data-client` workspace dep.
- `src/lib/manager-data-client.tsx` — ported `ManagerDataClientProvider` + hooks (`useManagerDataClient`, `useManagerOfflineDataEpoch`, `useBumpOfflineData`). `createDataClient({ persistence: 'indexeddb', basePath: env.apiBaseUrl, apiPrefix: '/api/v1' })`. **IndexedDB DB name `saluna-manager-offline` preserved** (data-client default) so installed users keep their offline queue.
- `src/components/manager-sync-bar.tsx` — ported `ManagerSyncBar`. Replaces `next/link` with TanStack `Link to=...`. Uses PWA `useAuth` from `#/lib/auth`.
- `src/routes/_authed.tsx` — wraps the authenticated shell in `ManagerDataClientProvider` and renders `ManagerSyncBar` above `<main>` (between sync bar and `BottomNav`).

**Verified:**
- `pnpm test` in `packages/data-client` → 20 passed (apiPrefix default preserves legacy behavior)
- `pnpm exec tsc --noEmit` in `apps/pwa` → only the pre-existing `appointments-module.ts` TS6133 warning (unchanged from main)
- `pnpm build` in `apps/pwa` → succeeds; sync UI lives in the `_authed` chunk

**Note on existing offline state:** Installed legacy users hit `retired manager app` at `saluna-manager-offline`. Both apps now write to the same DB. When a user moves to the PWA, queued mutations replay against Hono via the `/api/v1` rewrite — same endpoints, just a different prefix. No migration needed.

## Phase 4 — Shipped (2026-05-26)

**Done:** `/retention`, `/clients`, `/clients/$id`, `/services`, `/staff`, `/settings`.

**Pattern established (apply to remaining slices):** Router `loader` → `ensureQueryData` with the same key the component's `useQuery` uses; `useMutation` invalidates that key on success. Manager guard via `beforeLoad` using router context's `user`. Explicit `pendingComponent`/`errorComponent`. Offline-backed reads layer IDB on top via dedicated hooks. Drawer flows use `FormSheet` (vaul) + `useDismissGuard` + `runMutation`.

### `/retention` — Shipped (2026-05-26)

**PWA (`apps/pwa`):**
- `src/lib/api-client.ts` — added `retention: createRetentionApi(apiClient)`.
- `src/routes/_authed/retention.tsx` — manager-only (`beforeLoad` redirects non-managers to `/today`). Router `loader` calls `queryClient.ensureQueryData` against `api.retention.list`. `useQuery` shares the `['retention']` key; `useMutation` wraps `api.retention.updateStatus` and invalidates the same key on success. `busyId` derives from `useMutation`'s `isPending`+`variables`. Header uses `useNavigate` back to `/settings`.
- Unmigrated outbound links (`/calendar?clientId=...`, `/clients/$id`) use plain `<a>` until those routes migrate — full reload is acceptable since those routes do not yet exist in the PWA either.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning
- `pnpm build` → succeeds; retention chunk emitted

### `/clients` — Shipped (2026-05-26)

List page with offline-first IDB hydration, retention follow-up filter cross-query, and inline create/edit drawer (`FormSheet` + vaul).

**Deps added (`apps/pwa`):**
- `vaul` (for `FormSheet`).
- `<Toaster />` from `@repo/ui/toaster` rendered in `__root` (so `runMutation` toasts work).

**New PWA modules ported from `retired manager app`:**
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
- Drawer's raw-fetch fallback path now uses `api.clients.create/update` (cross-origin Hono) instead of legacy `/api/clients`; data-client offline path is unchanged. Error message preservation is weaker (`api-client` errors don't expose status codes the same way), but `DataClientHttpError` still flows through `runMutation`.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning
- `pnpm build` → succeeds; clients chunk 49.9 KB, form-sheet code lands in clients chunk

### `/clients/$id` — Shipped (2026-05-26)

Manager client profile with stats, tags, notes, upcoming appointment, open follow-ups, history, and inline edit drawer. Mirrors `/clients` data-flow: Router loader → `ensureQueryData(['clients', id, 'summary'])` → `useQuery` (shared key) + `useClientSummaryIndexedDbSources` for offline reads after first hydrate.

**New PWA modules:**
- `src/lib/use-clients-indexeddb.ts` — added `useClientSummaryIndexedDbSources` (mirrors list hook for `getSummary`/`hydrateSummaryFromServer`/`summaryLastSyncedAt`).
- `src/components/clients/client-summary-skeleton.tsx`.
- `src/routes/_authed/clients.$id.tsx`.

**Wiring fix:** `/clients` rows now navigate via `<Link to="/clients/$id" params={{id}} />` (an earlier deviation that opened the edit drawer in place is gone). The list-page FAB still opens the create drawer.

**Edit success:** invalidates both `['clients', id, 'summary']` and `['clients']` (list) so the list reflects edits without a manual refresh.

**Parity deviations:**
- "نوبت جدید" still uses plain `<a href="/calendar?clientId=...">` (calendar route not migrated yet).

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning
- `pnpm build` → succeeds; `clients._id` chunk 10.1 KB

### `/services` — Shipped (2026-05-26)

Manager-only catalog page: addon manager (list + drawer with category/family/service scopes) and catalog manager (collapsible bxsh→families→services tree, combo support, starter import flag). Data flows through `useManagerDataClient()` + `subscribe()`/`refreshCatalog()`; no TanStack Query layer (matches legacy pattern).

**PWA additions:**
- `api-client.ts` — added `services: createServicesApi(apiClient)`.
- `src/components/services/` — ported `service-addon-manager`, `service-addon-drawer`, `service-catalog-manager`, `service-category-drawer`, `service-family-drawer`, `service-drawer`, `service-picker`, `service-catalog-groups`. Drawers use `Drawer` from `@repo/ui/drawer` except `service-drawer` (vaul `FormSheet`).
- `src/routes/_authed/services.tsx` — manager guard via `beforeLoad`; ports legacy refresh-on-mount + subscribe pattern verbatim.

**Parity notes:**
- Starter import `localStorage` key (`saluna:starter-services-used:${salonId}`) preserved verbatim so first-time-import UX migrates cleanly.

### `/staff` — Shipped (2026-05-26)

Manager-only staff list with three drawers: `StaffDrawer` (create, vaul `FormSheet`), `StaffServicesDrawer` (restrict services per staff, native `Drawer`), `StaffScheduleDrawer` (weekly schedule, native `Drawer`).

**PWA additions:**
- `api-client.ts` — added `staff: createStaffApi(apiClient)`.
- `src/components/staff/` — ported `staff-drawer`, `staff-services-drawer`, `staff-schedule-drawer`, `staff-skeleton`.
- `src/routes/_authed/staff.tsx` — manager guard; data-client `subscribe()` pattern (no TanStack Query layer).

**Parity deviations:**
- Legacy `StaffDrawer` did raw `fetch('/api/staff', POST, …)` for create. PWA now calls `api.staff.create(input)` via cross-origin Hono; error envelope is wrapped in `DataClientHttpError` so `runMutation` keeps its message-preserving behavior.

### `/settings` — Shipped (2026-05-26)

Dual-mode (manager "بیشتر" / staff "تنظیمات"): profile card, dashboard metrics tiles, manager menu (links to migrated `/dashboard`, `/retention`, `/services`, `/staff`; unmigrated `/public-page` and `/onboarding` use plain `<a>` for full reload), notification preferences toggle, business hours form (TimePicker + slot interval), dark-mode toggle, logout.

**PWA additions:**
- `api-client.ts` — added `businessSettings`, `notifications`, `notificationPreferences`.
- `src/lib/theme.tsx` — small Vite-safe theme provider replacing `next-themes`. Stores `light|dark|system` under `saluna-theme` localStorage key; applies `light`/`dark` class to `<html>` and tracks `prefers-color-scheme`. Wired into `src/main.tsx` between `QueryClientProvider` and `AuthProvider`.
- `src/routes/_authed/settings.tsx` — full UI port; metrics via `api.dashboard.get`, prefs via `api.notificationPreferences.{get,update}`, business hours via `dc.businessSettings`.

**Deferred:**
- Staff push-notification settings (`StaffPushSettings`) — depends on Service Worker registration and `PushManager`, which are part of Phase 7 (PWA Hardening). Settings page for staff currently shows the standard sections without the push card.

### Phase 4 acceptance

- `pnpm exec tsc --noEmit` in `apps/pwa` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` in `apps/pwa` → succeeds. New chunks: `services` (~76 KB), `staff` (~29 KB), `settings` (~13 KB).
- Bottom-nav `matchPrefixes` for the manager "بیشتر" item extended to include `/services` and `/staff` so the active state holds across the settings sub-tree.

## Phase 5 — In Progress (2026-05-26)

Split into sub-slices so each lands in isolation: **5a calendar shell** (read-only grid + concurrent-cluster sheet) → **5b appointment drawer** (create/edit) → **5c detail drawer** → **5d availability drawer** → **5e `/today` + next-open-slot**.

### Phase 5a — Shipped (2026-05-26)

Read-only `/calendar` route lands with FullCalendar grid, view toggle (روز/هفته/ماه/لیست), staff filter (manager-only), concurrent-cluster sheet, IDB-backed offline reads, search-param-validated `date`. `appointmentId` / `clientId` deep-links and create/edit/availability drawers are deferred to 5b–5d and stubbed as toasts.

**PWA (`apps/pwa`):**
- Deps: `@fullcalendar/{core,daygrid,timegrid,list,interaction,react}@^6.1.20`.
- `package.json` + `pnpm install` performed.
- `api-client.ts` — added `appointments: createAppointmentsApi(apiClient)`.
- `src/components/brand/brand-mark.tsx` — minimal Vite-safe port (no asset versioning yet; Phase 7).
- `public/brand/*` — brand assets copied from `apps/pwa/public/brand`.
- `src/components/calendar/` — ported `calendar-header`, `staff-filter`, `concurrent-appointments-sheet` (verbatim minus `'use client'`), `salon-full-calendar` (verbatim + import path fix `@/` → `#/`), `calendar-skeleton`.
- `src/lib/use-calendar-indexeddb-sources.ts` — ported, retargeted at `#/lib/manager-data-client`, dropped unused `idbLoading`.
- `src/routes/_authed/calendar.tsx` — `validateSearch` (z.object{date, clientId, appointmentId}) + TanStack Query for appointments/staff/services/clients/business + `useCalendarIndexedDbSources` layered on top. Cluster sheet wired. Create/availability FABs, slot select, and single-event taps call a `toast` stub for 5b. `appointmentId`/`clientId` search params toast a hint and self-clear.
- `src/components/bottom-nav.tsx` — replaced `/dashboard` slot with `/calendar` (icon `CalendarRange`); staff items also gain `/calendar`. Dashboard remains reachable from the "بیشتر" menu (matchPrefixes already includes `/dashboard`).

**Parity deviations (deferred to 5b–5e):**
- No appointment create/edit drawer — slot taps and FAB toast "ساخت/ویرایش نوبت در نسخه‌ی بعدی فعال می‌شود".
- No appointment detail drawer — single-event tap on a non-clustered event toasts the same hint.
- No availability drawer — search FAB toasts the same hint.
- `?appointmentId=` / `?clientId=` deep-links toast a notice and clear themselves; will be honored once drawers ship.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` → succeeds. `calendar` chunk ~295 KB (FullCalendar + locales).

### Phase 5b — Shipped (2026-05-26)

Appointment **create** drawer lands on `/calendar`. Slot taps, FAB plus, and `?clientId=` deep links open the drawer; `?appointmentId=` and the availability FAB still toast a "next slice" hint (deferred to 5c/5d).

**PWA (`apps/pwa`):**
- `src/components/calendar/client-picker.tsx` — ported verbatim from `retired manager app`. Drawer-nested on touch, dismiss-on-outside on desktop. Data-client `clients.create` first; falls back to `api.clients.create({ …values, tags: values.tags ?? [] })` (same pattern as `client-drawer.tsx`).
- `src/components/calendar/appointment-drawer.tsx` — ported verbatim minus Next imports. Raw `fetch('/api/appointments', POST)` fallback replaced with `api.appointments.create(payload)`; raw `fetch('/api/services/:id/addons')` fallback replaced with `api.services.addons.forService(id, { signal })`; raw `fetch('/api/staff/booking-availability?...')` replaced with `api.staff.bookingAvailability({ date, startTime, endTime }, { signal })` (response cast to `{ staff: Array<{ staffId, available }> }` — api-client's generated `StaffResponse` type is wrong for this endpoint; not blocking).
- `src/routes/_authed/calendar.tsx` —
  - Added create-drawer state (`showCreateDrawer`, `createDate`, `createTime`, `initialStaffIdForCreate`, `initialServiceIdForCreate`, `initialClientIdForCreate`).
  - Wired `handleSlotSelect` (replaces `stubDrawer` for `onSlotSelect`), `handleAddAppointment` (FAB plus), `handleCreateDrawerOpenChange`, `handleAppointmentCreated`.
  - `?clientId=` deep link: when manager + client exists in current list, opens drawer pre-seeded with that client at `navDate` + `businessHours.workingStart`, then strips the param via `navigate({ to: '/calendar', search: ({ date }) => ({ date }), replace: true })`.
  - `?appointmentId=` still toasts + clears itself (5c).
  - Availability FAB toasts a "next slice" hint (5d).
  - `handleAppointmentCreated` does optimistic `queryClient.setQueryData` upsert into the current `['appointments','range', start, end]` cache (mirrors legacy `mutateAppointments` upsert with sort), then `invalidateQueries({ queryKey: ['appointments','range'] })`.
  - `onClientsChanged` invalidates `['clients']` so the picker's freshly-created client surfaces elsewhere.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` → succeeds. `calendar` chunk grew from ~295 KB to 324 KB (drawer + addons + picker + form schemas).

**Deferred to 5d:**
- Availability drawer.

### Phase 5c — Shipped (2026-05-26)

Appointment **detail** drawer lands on `/calendar`. Single-event taps (in any view), cluster-sheet picks, and `?appointmentId=` deep links now open the drawer. Edit, status change, delete, and "تکمیل اطلاعات مشتری" (placeholder client) all flow through the data-client when available and fall back to `@repo/api-client` cross-origin Hono.

**PWA (`apps/pwa`):**
- `src/components/calendar/appointment-detail-drawer.tsx` — ported from `retired manager app`. Path aliases `@/` -> `#/`. `useNetworkStatus` from `#/lib/network-status`. Raw-fetch fallbacks replaced:
  - `fetch('/api/services/:id/addons')` → `api.services.addons.forService(id, { signal })`
  - `fetch('/api/appointments/:id/complete-client', POST)` -> `api.appointments.completePlaceholderClient(id, ...)`
  - `fetch('/api/appointments/:id', PATCH)` (update + status) -> `api.appointments.update(id, ...)` / `api.appointments.updateStatus(id, status)`
  - `fetch('/api/appointments/:id', DELETE)` -> `api.appointments.delete(id)`
  - `ApiError` is caught and rewrapped as `DataClientHttpError` for `runMutation` message preservation. For the placeholder-client duplicate-phone flow, the duplicate `existingClient` is read from `ApiError.payload` (legacy read it from `res.json()`).
- `src/routes/_authed/calendar.tsx` —
  - Added `selectedAppointment` state. `handleAppointmentClick` now opens the drawer for non-clustered events; `handleConcurrentSelect(appointment)` opens it from the cluster sheet.
  - `?appointmentId=` deep link resolves against current `appointments` and opens the drawer (then strips the param via `navigate({ search: ({ date }) => ({ date }), replace: true })`). If the id isn't in the loaded range, the param is left in place so a subsequent loader hydration can pick it up.
  - `handleDetailChange({ type: 'updated' | 'deleted' })` mirrors the create flow's optimistic cache update: `updated` → `upsertAppointmentInCache` + keep drawer open with refreshed appointment; `deleted` → filter out + close drawer. Both then invalidate `['appointments','range']`.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` → succeeds. `calendar` chunk grew from 324 KB to ~349 KB (detail drawer + complete-client nested drawer).

**Deferred to 5d:**
- Availability drawer (search FAB still toasts).

### Phase 5d — Shipped (2026-05-26)

Availability ("بررسی زمان خالی") drawer lands on `/calendar`. The search FAB now opens the drawer; picking a slot closes it and re-opens the create drawer pre-seeded with `staffId` / `serviceId` / `date` / `startTime` (matching legacy `handleAvailabilitySlotSelect` behavior, including the `requestAnimationFrame` defer so the two vaul drawers don't fight each other on mount).

**PWA (`apps/pwa`):**
- `src/components/calendar/availability-drawer.tsx` — ported from `retired manager app`. Path aliases `@/` -> `#/`. `useNetworkStatus` from `#/lib/network-status`, `useDismissGuard` from `#/lib/use-dismiss-guard`, `ServicePicker` from `#/components/services/service-picker`. Raw `fetchJsonOrThrow('/api/appointments/availability?...')` replaced with `api.appointments.availability({ mode, serviceId, date, staffId? }, { signal })`. `HttpError` -> `ApiError` for the user-facing error message.
- `src/routes/_authed/calendar.tsx` —
  - Dropped the `toast`-based `stubAvailabilityDrawer`; added `showAvailabilityDrawer` state.
  - `handleOpenAvailability` (manager-only) wired to the search FAB.
  - `handleAvailabilitySlotSelect` mirrors legacy: clear client seed, set `initialStaffId`/`initialServiceId` from the picked slot, set `createDate`/`createTime`, then `requestAnimationFrame(() => setShowCreateDrawer(true))`.
  - Drawer mounted alongside `AppointmentDrawer` under `isManager`, with `initialDate={format(navDate, 'yyyy-MM-dd')}`.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` → succeeds. `calendar` chunk grew from ~349 KB to ~359 KB (availability drawer + `staff-service-autofill` + `availability` types).

**Deferred to 5e:**
- `/today` manager/staff variants and next-open-slot logic.

### Phase 5e — Shipped (2026-05-26)

`/today` manager and staff variants land, replacing the placeholder route. Manager view ships the weekstrip date picker, hero stats, attention items, queue, team load bars, and the create/detail/availability drawers wired the same way as `/calendar`. Staff view ships the live clock, "الان و بعدی" card, next-open-slot summary, today list with تایید/انجام شد/غیبت actions, and a "نگاه به فردا" preview.

**PWA (`apps/pwa`):**
- `api-client.ts` — added `today: createTodayApi(apiClient)`.
- `src/lib/next-open-slot.ts` — ported verbatim from legacy `retired manager app route (app)/today/next-open-slot.ts`.
- `src/lib/use-manager-today-indexeddb.ts` — ported; retargeted at `#/lib/manager-data-client`. Hydrates today/staff/services/clients into IDB when online, falls back to IDB-only when offline.
- `src/lib/offline-snapshot.ts` — added `useOfflineSnapshot(key, liveData)` hook (read on mount, write on every fresh `liveData`). Reuses the existing `saluna-offline-v1:` prefix and key shape — staff snapshots still land at `today:staff:<ymd>`, matching legacy.
- `src/components/status-pill.tsx` — ported.
- `src/components/today-skeleton.tsx` — ported (`ManagerTodaySkeleton`, `StaffTodaySkeleton`).
- `src/routes/_authed/today.tsx` — full port. `useSWR` -> TanStack `useQuery` (separate manager/staff query trees gated by role). Raw `fetch('/api/appointments/:id', PATCH {status})` replaced with `api.appointments.updateStatus(id, status)`; `removedAppointmentId` branch preserved off the typed union. `next/link` -> TanStack `Link to=...`, `useRouter().push` -> `useNavigate()` (only used for the manager cross-day create redirect to `/calendar?date=...`). Both views consume `useNetworkStatus` from `#/lib/network-status`; the staff view uses the new `useOfflineSnapshot`. Manager view consumes `useManagerTodayIndexedDbSources` + `useManagerDataClient`/`useBumpOfflineData` for offline-first behavior, identical to legacy.

**Parity deviations:**
- The manager view used legacy `router.push('/calendar?date=…')` after a cross-day create; PWA uses TanStack `navigate({ to: '/calendar', search: { date } })` which yields the same navigation but routed through the SPA (no full reload).
- The staff status patch went through raw fetch in legacy; in PWA `ApiError.message` flows through to the inline feedback banner via `api.appointments.updateStatus`. Same UX, same messages.

**Verified:**
- `pnpm exec tsc --noEmit` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` → succeeds. `today` chunk ~34 KB (skeletons + status pill + IDB hook share with already-loaded calendar drawers/utilities).

## Phase 6 — Shipped (2026-05-26)

`/requests` lands as a manager-only route with status tabs (در انتظار / تأیید شده / رد شده / لغو شده / منقضی شده), pending-card approve/reject flow with staff picker, and decided-card list. Bottom-nav gains a "درخواست‌ها" item with a live pending-count badge.

**Shared (`packages/api-client`):**
- `appointment-requests.ts` (new) — `createAppointmentRequestsApi` with `list({ status? })`, `approve(id, { staffId })`, `reject(id, { reason? })`. Types (`AppointmentRequestListItem`, `AppointmentRequestStatus`, etc.) are defined locally in api-client so the browser bundle does not pull `@repo/database`.
- `endpoints.ts` — added `appointmentRequests: '/api/v1/appointment-requests'`.
- `index.ts` — re-exports the new factory and types.

**PWA (`apps/pwa`):**
- `src/lib/api-client.ts` — registered `appointmentRequests: createAppointmentRequestsApi(apiClient)`.
- `src/routes/_authed/requests.tsx` — full UI port from `retired manager app route (app)/requests/page.tsx`. Router `loader` → `ensureQueryData(['appointment-requests','pending'])`; tab-scoped lists use `useQuery` keyed `['appointment-requests', <status>]`. Approve/reject are `useMutation`s; on success both the current tab key and the pending key are invalidated so the badge updates immediately. `ApiError.message` is surfaced inline (preserves legacy parity for "تأیید درخواست انجام نشد" / "رد درخواست انجام نشد" plus server-supplied messages). Staff/services lookups are gated on `status === 'pending'`.
- `src/components/bottom-nav.tsx` — added manager-only `/requests` item (Inbox icon) between `/calendar` and `/clients`. `useQuery` for pending-count with `refetchInterval: 60_000`; badge shows `99+` over 99, mirroring legacy.

**Parity deviations:**
- `/public-page` link in the "این درخواست‌ها از صفحه عمومی…" banner uses a plain `<a href="/public-page">` (full reload) because `/public-page` is deferred per the plan.
- The legacy bottom-nav also matched `/onboarding` under the "بیشتر" prefix; the PWA matchPrefixes set is unchanged here (no onboarding route migrated yet).

**Verified:**
- `pnpm exec tsc --noEmit` in `apps/pwa` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` in `apps/pwa` → succeeds. `requests` chunk ~13 KB.
- `@repo/api-client` vitest suite still fails on the pre-existing `/api/*` → `/api/v1/*` path expectations (stale tests from Phase 0/1; not introduced by this slice).

## Phase 7 — Shipped (2026-05-26)

PWA hardening lands: real manifest + icons/screenshots, service worker with Vite-aware caching, in-app update prompt, and the legacy iOS/Android install drawer.

**Assets (`apps/pwa/public/`):**
- Copied from `apps/pwa/public`: `icons/` (full set incl. maskable), `screenshots/manifest-*.png`, `offline-launch.html`, `favicon.ico`, `favicon-{16,32,196}x{...}.png`, `apple-touch-icon.png`, `icon-base.png`, `icon-{dark,light}-32x32.png`, `logo.png`.
- Removed Vite starter `manifest.json`, `logo192.png`, `logo512.png`.
- New `manifest.webmanifest` — static port of legacy `retired manager app route manifest.ts` (Persian/RTL, theme/background colors, full icon set incl. maskable, screenshots, calendar/clients/today shortcuts). Asset-version query string dropped from manifest entries (was Next-only via `withPwaAssetVersion`); a future bump uses `VITE_PWA_ASSET_VERSION` injected at the SW + register layer.
- New `sw.js` — ported from `apps/pwa/public/sw.js`. Same precache list, navigation cache-then-network, navigation fallback chain, static media SWR, push/notificationclick handlers. Adapted for Vite:
  - Added `/services`, `/requests` to `NAVIGATION_FALLBACK_PATHS` and `shouldCacheNavigation` (routes that exist in the PWA but not legacy at the time).
  - New `isHashedAssetRequest` cache-first strategy for `/assets/*` (Vite's hashed bundle output) into `ASSET_CACHE_NAME`. Hashed names guarantee cache-busting; new builds get fresh entries automatically and old caches are dropped on activate.
  - Bypass cross-origin requests entirely (Hono is on a different origin, so the SW would never see them, but explicit guard is cheap).
  - Static media set extended to `/brand/` and `/screenshots/` (was `/icons/`, `/landing/` in legacy).
  - Same `/api/` opt-out preserved.

**PWA (`apps/pwa`):**
- `src/lib/pwa-assets.ts` — Vite port of `apps/pwa/src/lib/pwa-assets.ts`. Reads `import.meta.env.VITE_PWA_ASSET_VERSION` with the same `2026-05-26-v1` default.
- `src/env.ts` — added `pwaAssetVersion` field for completeness alongside other VITE-prefixed values.
- `src/components/pwa/service-worker-register.tsx` — Vite port of `apps/pwa/src/components/pwa/service-worker-register.tsx`. Same dev cleanup (unregister + purge caches), same update toast UX, same controllerchange/visibility/focus/10-minute interval re-check pattern. **Build-id replacement:** instead of `extractNextBuildId`, we extract the Vite hashed entry script path (`/assets/index-XXXXX.js`) from `document.scripts` at boot, then on each re-check fetch `/` (no-store) and compare against the script referenced in the fresh index.html. Mismatch → prompt for reload.
- `src/components/pwa/install-prompt.tsx` — Vite port of `apps/pwa/src/components/pwa/install-prompt.tsx`. `usePathname` → `useRouterState({ select: s => s.location.pathname })`. All localStorage keys preserved verbatim (`saluna-pwa-first-visit`, `saluna-pwa-install-dismissed-v2`, `saluna-pwa-install-qualified-v1`, `saluna-pwa-install-auto-opened-v1`) so existing installed-user state migrates cleanly. Same value-moment paths, iOS Safari detection, and `beforeinstallprompt`/`appinstalled` handling.
- `src/routes/__root.tsx` — mounts `<ServiceWorkerRegister />` and `<InstallPrompt />` alongside `<Toaster />`.
- `index.html` — added theme-color (light/dark via media), color-scheme, `application-name`, apple-web-app metas, `format-detection`, description, `<link rel="manifest" href="/manifest.webmanifest">`, full favicon/pwale-touch-icon link set.

**Deferred:**
- Vazirmatn font loading — still system fonts; Iran VPS / no Google Fonts constraint means self-hosting is the right path. Tracked separately.
- Staff push-notification settings (depends on `PushManager` subscribe flow); the SW already handles `push`/`notificationclick`, so wiring `StaffPushSettings` is unblocked but unscoped here.
- Deploy-time SPA fallback (out of scope per plan); when shipping, the static host must rewrite all `/<route>` GETs to `/index.html` so the SPA hydrates from any deep link.

**Verified:**
- `pnpm exec tsc --noEmit` in `apps/pwa` → only the pre-existing `appointments-module.ts` TS6133 warning.
- `pnpm build` in `apps/pwa` → succeeds. `dist/` contains `manifest.webmanifest`, `sw.js`, `offline-launch.html`, full favicon/icon set, `icons/`, `screenshots/`, hashed `assets/` bundle. `index.html` references `/assets/index-<hash>.js` (the same shape the SW-register parser looks for).

## Recommended First Implementation Slice

Build the smallest useful vertical slice:

1. Normalize Hono API base URL/path strategy for `apps/pwa`.
2. Add PWA auth provider and API client factory.
3. Consolidate TanStack router creation.
4. Add root/pwa/authenticated layout routes.
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
