# Admin V1 Rebuild Issues

Local issue backlog generated from [ADMIN_PANEL_IMPLEMENTATION_PLAN.md](ADMIN_PANEL_IMPLEMENTATION_PLAN.md).

Triage label for all issues: `needs-triage`

## Proposed Breakdown Review

1. **ADMIN-001: Rebuild the admin app shell with official shadcn sidebar and file-based routes**
   - **Type**: AFK
   - **Blocked by**: None
   - **User stories covered**: Platform admin can enter a focused V1 admin shell with RTL layout, right sidebar navigation, login guard, and command search.

2. **ADMIN-002: Expose admin runtime data source and show live-data guardrails** ✅
   - **Type**: AFK
   - **Blocked by**: ADMIN-001
   - **User stories covered**: Platform admin can tell whether they are using local or live data before reading or mutating anything.

3. **ADMIN-003: Move rebuilt admin features onto generated API client query options**
   - **Type**: AFK
   - **Blocked by**: ADMIN-001
   - **User stories covered**: Admin pages use generated contract-backed data access instead of handwritten fetch wrappers.

4. **ADMIN-004: Rebuild Overview as a feature slice** ✅
   - **Type**: AFK
   - **Blocked by**: ADMIN-001, ADMIN-003
   - **User stories covered**: Platform admin can land on `/overview` and see real platform metrics plus recent audit activity.

5. **ADMIN-005: Rebuild Salons list and salon operations** ✅
   - **Type**: AFK
   - **Blocked by**: ADMIN-001, ADMIN-002, ADMIN-003
   - **User stories covered**: Platform admin can search salons, inspect salon overview, update salon status with a reason, and add internal notes.

6. **ADMIN-006: Add read-only salon tenant data tabs**
   - **Type**: AFK
   - **Blocked by**: ADMIN-005
   - **User stories covered**: Platform admin can inspect a salon's Clients, Appointments, Appointment Requests, Staff, and Services without tenant mutations.

7. **ADMIN-007: Rebuild Catalog Presets CRUD with canonical catalog language**
   - **Type**: AFK
   - **Blocked by**: ADMIN-001, ADMIN-002, ADMIN-003
   - **User stories covered**: Platform admin can manage CatalogPreset records using category, family, and service variant language.

8. **ADMIN-008: Rebuild Audit Log as a filterable feature slice** ✅
   - **Type**: AFK
   - **Blocked by**: ADMIN-001, ADMIN-003
   - **User stories covered**: Platform admin can review audited admin actions with filters.

9. **ADMIN-009: Move Platform Admins into role-gated Settings**
   - **Type**: AFK
   - **Blocked by**: ADMIN-001, ADMIN-002, ADMIN-003
   - **User stories covered**: Platform owner can manage ongoing platform access after bootstrap.

10. **ADMIN-010: Remove legacy admin surfaces and monolithic admin page**
    - **Type**: AFK
    - **Blocked by**: ADMIN-004, ADMIN-005, ADMIN-006, ADMIN-007, ADMIN-008, ADMIN-009
    - **User stories covered**: V1 admin exposes only the focused route set and no hidden legacy routes.

11. **ADMIN-011: Verify Admin V1 end to end and document attribution**
    - **Type**: AFK
    - **Blocked by**: ADMIN-010
    - **User stories covered**: Platform admin can run, test, and visually verify the rebuilt admin with proper third-party attribution.

## ADMIN-001: Rebuild the admin app shell with official shadcn sidebar and file-based routes

Labels: `needs-triage`

## What to build

Replace the current admin layout and manual router with a focused V1 shell using the official shadcn Radix sidebar pattern, RTL setup, and TanStack file-based routes. The result should boot at `/`, redirect to `/overview`, protect admin routes behind the existing Better Auth platform-admin session, and expose only the V1 navigation: Overview, Salons, Catalog Presets, Audit Log, and Settings.

## Acceptance criteria

- [x] `apps/admin` uses TanStack Router file-based routes for `/`, `/login`, `_admin`, `/overview`, `/salons`, `/salons/$salonId`, `/catalog-presets`, `/audit-log`, and `/settings`.
- [x] The old manual route construction is no longer the routing authority.
- [x] The admin shell uses official shadcn sidebar primitives with `side="right"` and `variant="inset"`.
- [x] RTL is configured through `html lang="fa" dir="rtl"`, Radix direction, `components.json`, logical Tailwind classes, and portal/sheet direction where needed.
- [x] Primary nav excludes deferred legacy surfaces such as Users, Messaging Health, and Support Lookup.
- [x] Command search navigates only reachable V1 routes.
- [x] Admin login/guard behavior still works with the Better Auth session.

## Blocked by

None - can start immediately

## ADMIN-002: Expose admin runtime data source and show live-data guardrails

Labels: `needs-triage`

## What to build

Make the local admin stack explicitly aware of whether the local API is connected to local or live data. The UI should show a persistent data-source badge or banner, and live-data mutations should have stronger confirmation copy before affecting production data.

## Acceptance criteria

- [x] Add `ADMIN_DATA_SOURCE=local | live` validation to the API runtime environment.
- [x] Expose the current data source through `/api/v1/admin/auth/me` or `/api/v1/admin/runtime`.
- [x] Add local scripts such as `dev:admin-stack:local-data` and `dev:admin-stack:live-data`.
- [x] The admin shell shows a persistent visible badge/banner in live-data mode.
- [x] Live-data mutation dialogs clearly state that they affect live production data.
- [x] High-impact live-data mutations, including salon status changes and platform admin changes, require an extra confirmation phrase such as `LIVE`.
- [x] API env parsing and admin runtime behavior have focused tests.

## Blocked by

- ADMIN-001

## ADMIN-003: Move rebuilt admin features onto generated API client query options

Labels: `needs-triage`

## What to build

Configure rebuilt admin features to use generated SDK functions and TanStack query options from `@repo/api-client`. New V1 feature code should avoid the handwritten `apps/admin/src/lib/admin-api.ts` wrapper except for temporary adapters around deferred legacy surfaces.

## Acceptance criteria

- [ ] The generated API client is configured once for the admin app with credentials included.
- [ ] Rebuilt V1 queries use generated query options from `@repo/api-client`.
- [ ] Rebuilt V1 mutations use generated SDK mutation helpers or generated SDK functions.
- [ ] Query keys and invalidation use generated keys where practical.
- [ ] `apps/admin/src/lib/admin-api.ts` is not imported by rebuilt V1 feature folders.
- [ ] OpenAPI and `@repo/api-client` generation still succeed.

## Blocked by

- ADMIN-001

## ADMIN-004: Rebuild Overview as a feature slice

Labels: `needs-triage`

## What to build

Move the Overview screen out of the monolithic admin page into `features/overview`, backed by the generated admin overview query. The page should show real platform metrics and recent audit activity without demo charts or fake data.

## Acceptance criteria

- [x] `/overview` renders from `features/overview`.
- [x] Overview data comes from the generated admin overview query.
- [x] Metrics use real Saluna admin API data only.
- [x] Recent audit activity is visible and links or references target data where available.
- [x] Loading, empty, and error states are handled.
- [x] Admin typecheck, lint, and tests cover the overview feature.

## Blocked by

- ADMIN-001
- ADMIN-003

## ADMIN-005: Rebuild Salons list and salon operations

Labels: `needs-triage`

## What to build

Move salon management into `features/salons` with a searchable paginated salon table, salon overview detail, internal notes, and salon status mutation. Mutations must require explicit reasons and honor live-data guardrails.

## Acceptance criteria

- [x] `/salons` renders a searchable, paginated salon table from generated admin salon queries.
- [x] `/salons/$salonId` renders a salon Overview tab with salon summaries and existing status.
- [x] Salon status changes require a reason dialog.
- [x] Internal salon notes can be listed and created with a required reason.
- [x] Live-data mode adds the extra production-data warning and confirmation phrase for salon status changes.
- [x] Successful mutations invalidate the relevant generated query keys.
- [x] API, generated client, and UI tests cover the salon list/detail/status/note path.

## Blocked by

- ADMIN-001
- ADMIN-002
- ADMIN-003

## ADMIN-006: Add read-only salon tenant data tabs

Labels: `needs-triage`

## What to build

Add read-only salon detail tabs for Clients, Appointments, Appointment Requests, Staff, and Services. Each tab should have a narrow paginated endpoint under the selected salon and render operationally useful fields without allowing tenant-scoped mutations from the platform admin.

## Acceptance criteria

- [ ] Add `GET /api/v1/admin/salons/:id/clients`.
- [ ] Add `GET /api/v1/admin/salons/:id/appointments`.
- [ ] Add `GET /api/v1/admin/salons/:id/appointment-requests`.
- [ ] Add `GET /api/v1/admin/salons/:id/staff`.
- [ ] Add `GET /api/v1/admin/salons/:id/services`.
- [ ] OpenAPI and `@repo/api-client` are regenerated for the new endpoints.
- [ ] `/salons/$salonId` has read-only tabs for Clients, Appointments, Appointment Requests, Staff, and Services.
- [ ] UI copy uses `Client`, `Appointment`, `AppointmentRequest`, `Staff`, and `ServiceVariant` where variant-level distinction matters.
- [ ] No Client, Appointment, AppointmentRequest, Staff, or Service mutation actions appear in these tabs.
- [ ] API and UI tests cover at least one populated and one empty state per tab group.

## Blocked by

- ADMIN-005

## ADMIN-007: Rebuild Catalog Presets CRUD with canonical catalog language

Labels: `needs-triage`

## What to build

Move Catalog Presets into `features/catalog-presets`, backed by generated admin CatalogPreset queries and mutations. The editor should manage a `CatalogPreset` tree using category, family, and service variant language, require a reason for every mutation, and avoid template/default/package/bundle wording.

## Acceptance criteria

- [ ] `/catalog-presets` renders a searchable, paginated Catalog Presets table.
- [ ] Create and update dialogs use generated admin CatalogPreset mutations.
- [ ] The tree editor supports `PresetCategory -> PresetFamily -> PresetVariant` editing.
- [ ] UI copy uses `Catalog Presets`, `قالب خدمات`, category, family, and service variant.
- [ ] Mutation dialogs require a reason.
- [ ] Live-data mode shows production-data warning copy before CatalogPreset mutations.
- [ ] Successful mutations invalidate generated CatalogPreset query keys.
- [ ] API, generated client, and UI tests cover create/update/list behavior.

## Blocked by

- ADMIN-001
- ADMIN-002
- ADMIN-003

## ADMIN-008: Rebuild Audit Log as a filterable feature slice

Labels: `needs-triage`

## What to build

Move Audit Log into `features/audit-log`, backed by the generated admin audit-log query. The page should let platform admins inspect recorded admin actions with filters and pagination.

## Acceptance criteria

- [x] `/audit-log` renders from `features/audit-log`.
- [x] Audit events are fetched through generated admin audit-log query options.
- [x] Filters support action, target type, target id, salon id, search, page, and page size where supported by the API.
- [x] Table rows show actor, role, action, target, reason, salon id, and created time when available.
- [x] Loading, empty, and error states are handled.
- [x] UI tests cover filtering and pagination state.

## Blocked by

- ADMIN-001
- ADMIN-003

## ADMIN-009: Move Platform Admins into role-gated Settings

Labels: `needs-triage`

## What to build

Expose ongoing platform access management through Settings for `platform_owner` users. `PLATFORM_ADMIN_BOOTSTRAP_PHONES` remains only the initial/emergency bootstrap path; after bootstrap, platform admins are managed through the Settings UI.

## Acceptance criteria

- [ ] Settings includes a `Platform Admins` area only for `platform_owner` users.
- [ ] Platform owner can list platform admins through generated admin platform-admin queries.
- [ ] Platform owner can grant/update platform admin access with a required reason.
- [ ] Live-data mode requires production-data warning copy and extra confirmation phrase before platform admin mutations.
- [ ] Non-owner platform roles cannot reach or use platform-admin management UI.
- [ ] Bootstrap copy explains that `PLATFORM_ADMIN_BOOTSTRAP_PHONES` is for initial/emergency platform owner bootstrap only.
- [ ] API and UI tests cover owner access, non-owner denial, and mutation reason handling.

## Blocked by

- ADMIN-001
- ADMIN-002
- ADMIN-003

## ADMIN-010: Remove legacy admin surfaces and monolithic admin page

Labels: `needs-triage`

## What to build

Remove the legacy admin monolith and unreachable V1-deferred surfaces from the rebuilt app. The route tree, navigation, command menu, and feature folders should reflect the focused Admin V1 boundary.

## Acceptance criteria

- [ ] `features/admin-page.tsx` is removed after all V1 routes have feature-owned replacements.
- [ ] Hidden compatibility routes for `/users`, `/messaging-health`, and `/support-lookup` are not present.
- [ ] Old custom `AdminSidebar` usage is deleted or fully disconnected.
- [ ] Deferred API endpoints may remain server-supported but are not reachable from V1 admin UI.
- [ ] Temporary `adminApi` adapters are removed unless still required by an explicitly deferred legacy surface.
- [ ] Navigation, command search, and route definitions expose only V1 routes plus role-gated platform-admin settings.
- [ ] Admin typecheck, lint, tests, and build pass.

## Blocked by

- ADMIN-004
- ADMIN-005
- ADMIN-006
- ADMIN-007
- ADMIN-008
- ADMIN-009

## ADMIN-011: Verify Admin V1 end to end and document attribution

Labels: `needs-triage`

## What to build

Run the full Admin V1 verification pass and make sure copied/adapted MIT source patterns are attributed. The rebuilt admin should be tested through commands and browser verification across desktop, collapsed, rail, mobile sheet, and RTL states.

## Acceptance criteria

- [ ] `pnpm --filter @repo/admin typecheck` passes.
- [ ] `pnpm --filter @repo/admin lint` passes.
- [ ] `pnpm --filter @repo/admin test` passes.
- [ ] `pnpm --filter @repo/admin build` passes.
- [ ] `pnpm --filter @repo/api test:unit` passes.
- [ ] `pnpm generate:api-contract` passes.
- [ ] `pnpm generate:api-client` passes.
- [ ] Browser verification covers sidebar desktop, collapsed, rail, mobile sheet, and RTL behavior.
- [ ] Browser verification covers command search navigation, salon detail tabs, CatalogPreset CRUD, and live-data mutation warnings.
- [ ] `apps/admin/THIRD_PARTY_NOTICES.md` is kept or updated for copied/adapted MIT source.

## Blocked by

- ADMIN-010
