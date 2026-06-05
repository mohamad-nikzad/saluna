# Plan: Week-view "N همزمان" concurrent collapsing

## Goal

In the **week view** of the calendar, collapse appointments that overlap in time into a
single tappable **"N همزمان"** (N concurrent) block instead of FullCalendar's default
cramped side-by-side lanes. Tapping the block opens the existing concurrent gantt sheet.
Single (non-overlapping) appointments keep rendering as normal event chips. Also add a
per-day appointment **count** to the week column headers.

This is a follow-up to already-landed work (the concurrent gantt sheet + day/list restyle).
**Reuse what already exists — do not rebuild the sheet.**

## Context you need (the app)

- App: `retired manager app` — Saloora, a Persian/RTL salon PWA (Next.js + shadcn/ui + Tailwind v4 +
  `@repo/brand-tokens`). Manager and staff roles; staff get a read-only calendar.
- The calendar page renders a **restyled FullCalendar** (`@fullcalendar/react`). The product
  decision (see `SALOORA_V2_MIGRATION_PLAN.md`, Phase 5) is **restyle FullCalendar, do not
  replace it**. Keep that constraint.
- FullCalendar view mapping (in `salon-full-calendar.tsx` → `calendarViewToFc`):
  `day`→`timeGridDay`, `week`→`timeGridWeek`, `month`→`dayGridMonth`, `list`→`listWeek`.

### The design (what "N همزمان" looks like)

Week view = a 7-day time grid (hours ~8–20). Each day column shows:
- a normal chip with the client's first name when only one appointment occupies that time, or
- a single **"N همزمان"** pill (e.g. "۳ همزمان", "۵ همزمان") covering the busy window when
  several appointments overlap there.

Column headers show the weekday + date + a small appointment count for that day.
Tapping a "N همزمان" pill opens the per-staff gantt bottom sheet (already built).

## Reuse these — already implemented and verified

All in `apps/pwa/src/components/calendar/`:

- **`concurrent-appointments-sheet.tsx`** exports:
  - `buildConcurrencyClusters(appointments): Map<string, AppointmentWithDetails[]>` — groups
    appointments into **connected components of time-overlap, per date**. Each appointment id
    maps to the cluster array it belongs to (a cluster of size ≥ 2 = concurrent). **Use this;
    do not write a new overlap algorithm.**
  - `ConcurrentAppointmentsSheet` — the bottom sheet (hero "N نوبت همزمان" + per-staff gantt
    "چه کسی، چه زمانی؟" + time-ordered list "به ترتیب زمان"). Already rendered in the page.

- **`salon-full-calendar.tsx`** already has: the `events` useMemo (builds `EventInput[]` with
  rich `extendedProps`), `handleEventClick`, an `eventContent` callback that returns `{ html }`
  per view, a `dayHeaderContent` callback, and helpers `staffColorToCssVar`, `getInitials`,
  `durationMinutes`, `escapeHtml`. **Follow these existing patterns** (note: content callbacks
  return HTML strings, not React nodes — this is deliberate, to avoid React `flushSync` issues
  with `@fullcalendar/react`; keep doing that).

- **`page.tsx`** (`app/(app)/calendar/page.tsx`) already has: `clustersById` (a
  `buildConcurrencyClusters` memo over `filteredAppointments`), a `concurrentCluster` state +
  `setConcurrentCluster`, the `<ConcurrentAppointmentsSheet>` wired to it, and
  `handleAppointmentClick` which routes a tap on an *overlapping single event* to the sheet in
  non-week views. Keep that behavior for day view.

## Implementation steps

### 1. Emit synthetic cluster events for week view (`salon-full-calendar.tsx`)

In the `events` useMemo, branch on `view === 'week'`:

- Import `buildConcurrencyClusters` from `./concurrent-appointments-sheet`.
- Build clusters over the `appointments` prop (it is already staff-filtered upstream).
- Iterate appointments; track which clusters you've already emitted (dedupe by cluster
  reference / by the lowest appointment id in the cluster).
  - **Cluster (size ≥ 2):** emit **one** synthetic `EventInput`:
    - `id`: stable, e.g. `cluster:<sortedFirstAptId>`
    - `start`: min `startTime` in the cluster; `end`: max `endTime` in the cluster (same date)
    - `extendedProps: { kind: 'cluster', clusterIds: string[], count: number }`
    - `title`: `${toPersianDigits(count)} همزمان`
    - styling: neutral "busy" look (see CSS step). Do **not** tint by a single staff color.
  - **Singleton (size 1):** emit the normal event exactly as today (staff color border, the
    existing rich `extendedProps`, `kind: 'single'`).
- For all **other views** (day/month/list), keep emitting individual events unchanged. Add
  `kind: 'single'` to their `extendedProps` so the click handler can branch uniformly.

Keep an `appointmentsById` map (already present) to resolve ids on click.

### 2. Route cluster clicks to the sheet

- Add a prop to `SalonFullCalendarProps`: `onClusterClick?: (cluster: AppointmentWithDetails[]) => void`.
- In `handleEventClick`, read `info.event.extendedProps.kind`:
  - `'cluster'`: resolve `clusterIds` → `AppointmentWithDetails[]` via `appointmentsById`, then
    call `onClusterClick(resolved)`. Return early.
  - otherwise: current behavior (`onEventClick(apt)`).
- In `page.tsx`, pass `onClusterClick={setConcurrentCluster}` to `<SalonFullCalendar>`. The
  sheet is already wired to `concurrentCluster`. No new state needed.

### 3. Render the "N همزمان" pill (`eventContent` in `salon-full-calendar.tsx`)

Add a branch at the top of the existing `eventContent` callback:
- if `extendedProps.kind === 'cluster'`, return `{ html: ... }` for a `.fc-apt-cluster` block:
  big count + "همزمان", optionally a row of small stacked staff-color dots (resolve colors
  from the cluster's staff via `clusterIds` — you may stash a `dotColors: string[]` in
  `extendedProps` when building the synthetic event to avoid lookups here).
- otherwise: the existing day/list/timegrid rendering, unchanged.

### 4. Per-day counts in week headers (`dayHeaderContent`)

- Build a `Map<string /*yyyy-MM-dd*/, number>` of appointment counts (memo over `appointments`).
- In `dayHeaderContent`, when `view === 'week'`, append a small count line under the existing
  `day-header-compact` markup, e.g. `<span class="day-header-count">${n} نوبت</span>` (omit or
  show "—" when zero). Keep day/month header markup otherwise unchanged.

### 5. Styles (`packages/ui/styles/globals.css`)

Add under the existing `.salon-fullcalendar` rules:
- `.fc-apt-cluster` — neutral busy pill: subtle plum/neutral background
  (`color-mix(in oklch, var(--primary) 12%, var(--card))`), `var(--border)` border, centered
  content, count bold + "همزمان" muted; optional `.fc-apt-cluster-dots` for stacked color dots.
- `.day-header-count` — small muted line (`font-size: 0.6rem; color: var(--muted-foreground)`).
- Verify the cluster pill overrides the per-event `borderColor`/`backgroundColor` FullCalendar
  applies inline (the synthetic event sets none, so this should be clean — confirm visually).

## Scope / decisions

- **Week view only.** Day view stays as individual chips (already restyled); its overlapping
  single taps already open the sheet via `handleAppointmentClick` — leave that as-is.
- Month and list views: unchanged.
- Collapse threshold: **cluster size ≥ 2** (matches the design's "۲ همزمان").
- Cancelled/done appointments still count toward the cluster and its count (the sheet already
  renders them muted/struck-through).
- Read-only (staff) role: cluster pills still open the sheet (view-only); fine.

## Edge cases to handle

- Stable synthetic ids (sort cluster ids) so week re-renders don't churn.
- A long busy day can merge into one connected component spanning several hours → one tall
  pill. That's acceptable ("busy block"). If it looks bad, the fallback is to also show the
  window time range inside the pill; do not change the clustering algorithm.
- Staff filter changes recompute clusters automatically (clusters are derived from the
  `appointments` prop, which is filtered upstream). Confirm.
- Empty days: header count shows nothing/zero, grid empty.

## Verification

1. `pnpm --filter @repo/pwa typecheck` and lint the touched files — must pass.
2. Run the dev server via the preview tooling (`.claude/launch.json` has an `app` config on
   port 3000) and open `/calendar`, mobile viewport.
3. **The local dev DB has no overlapping appointments.** To exercise the feature without
   mutating data, inject overlaps **client-side only**: monkey-patch `window.fetch` in the
   page context to append a few overlapping appointments to the `/api/appointments?startDate...`
   response, then trigger an SWR refetch (nudge the date with the prev/next buttons so the
   range key changes). The patch is lost on reload and writes nothing to the DB. (This is how
   the sheet itself was verified.)
4. Confirm: week view shows "N همزمان" pills where appointments overlap; singletons render as
   normal chips; tapping a pill opens the gantt sheet with the right cluster; header counts
   render; check **light and dark**; no console errors.

## Files to touch

- `apps/pwa/src/components/calendar/salon-full-calendar.tsx` — synthetic events, click routing,
  `eventContent` + `dayHeaderContent` branches, count map.
- `retired manager app route (app)/calendar/page.tsx` — pass `onClusterClick={setConcurrentCluster}`.
- `packages/ui/styles/globals.css` — `.fc-apt-cluster`, `.day-header-count`.
- (Reuse, no change) `apps/pwa/src/components/calendar/concurrent-appointments-sheet.tsx`.
