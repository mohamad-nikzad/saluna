# Catalog Presets — Phased Implementation Plan

Ready-made trees of `دسته → گروه → خدمت` that a manager imports during onboarding (and later from the catalog screen) to skip building the service catalog by hand.

See `CONTEXT.md` for the locked glossary entries (`CatalogPreset`, `PresetCategory`, `PresetFamily`, `PresetVariant`).

---

## Locked design decisions

| # | Decision | Notes |
|---|---|---|
| 1 | **Name:** `CatalogPreset` / `قالب خدمات` | Not "package" — collides with `Combo ServiceVariant` and the `_Avoid_` list on `ServiceVariant`. |
| 2 | **Persian levels:** `دسته` (Category) → `گروه` (Family) → `خدمت` (Variant) | Pinned in `CONTEXT.md`. UI copy must use these. |
| 3 | **No `salonType` field on salons** | Presets are freely pickable. No identity field to maintain. |
| 4 | **DB-backed**, seeded from code now | Future admin panel = CRUD over the same table. No schema change needed later. |
| 5 | **Pure copy on apply**, audit row in `preset_applications` | No FK back to preset from `services` / `service_families` / `service_categories`. Imported rows are normal salon-scoped rows. |
| 6 | **Multiple presets allowed**, but UI **disables** any preset whose top-level `دسته` already exists in the salon's catalog | Strict collision rule. No merge UI. No skip-on-collision per-row. |
| 7 | **Delete-only preview** before apply | Manager toggles خدمت / گروه / دسته rows off; can't edit fields. Post-apply hint: "می‌توانید قیمت و جزئیات هر خدمت را بعداً از بخش خدمات تغییر دهید." |
| 8 | **Picker reachable from onboarding (primary) and catalog screen** | Same component, same API. Manual single-خدمت form retained in onboarding as fallback. |
| 9 | **Schema:** one `catalog_presets` table with `tree jsonb`, validated by a shared Zod schema | No `_fa` suffix on columns — Persian copy is the default in this codebase. |
| 10 | **Seed one placeholder preset now** (`قالب عمومی`) | Real per-vertical content drafted later with domain input. |

---

## Out of scope (deferred)

- ADR — explicitly skipped at the user's request.
- Refactor of the onboarding flow into a true multi-step form. Tracked separately.
- Rethinking the current "two-form" دسته/گروه/خدمت creation UX. Picker reduces urgency.
- Per-vertical preset content (ناخن، مو، پوست، اسپا، …). Needs domain input.
- Admin panel for editing presets. Table shape is admin-panel-ready; UI comes later.

---

## Phase 1 — Schema & shared validation

**Goal:** the data model and the Zod tree schema land first, with no runtime callers yet.

- `packages/salon-core/src/forms/catalog-preset.ts` — Zod schema for the tree:
  - `presetVariantSchema { name, duration, price, color, description? }`
  - `presetFamilySchema { name, variants: presetVariantSchema[] }`
  - `presetCategorySchema { name, families: presetFamilySchema[] }`
  - `presetTreeSchema = presetCategorySchema[]` (a preset can ship multiple دسته roots)
  - Export `CatalogPresetTree`, `PresetCategoryInput`, `PresetFamilyInput`, `PresetVariantInput` types.
- `packages/database/src/schema.ts` — add Drizzle tables:
  - `catalog_presets (id, slug unique, name, description, tree jsonb, sort_order, is_active, created_at, updated_at)`
  - `preset_applications (id, salon_id fk, preset_id fk, applied_at, imported_variant_ids uuid[])`
- `packages/database/src/migrations/0017_catalog_presets.sql` — matching SQL, follow existing migration style (`DO $$ … duplicate_object` guards, `IF NOT EXISTS` indexes).
- `packages/database/src/seed/catalog-presets.ts` (or add to existing seed runner) — upsert one placeholder preset `slug=general`, `name=قالب عمومی`, containing the existing `SERVICE_CATEGORIES` translated to دسته/گروه/خدمت rows.

**Exit criteria:** migration runs cleanly, seed upserts the placeholder, types compile across the workspace.

---

## Phase 2 — API: list + apply

**Goal:** server endpoints the UI will call.

- `apps/app/app/api/catalog-presets/route.ts`:
  - `GET` → returns the list of active presets, each with a `disabled: boolean` flag and `disabledReason: 'collision' | null`. Collision = any top-level `دسته` name in the preset's tree already exists in the caller's `service_categories`. Sorted by `sort_order`.
- `apps/app/app/api/catalog-presets/[id]/apply/route.ts`:
  - `POST { variantSlugsToKeep: string[] }` (or whatever shape the picker emits — likely a structural delete-list).
  - Server re-validates: preset is active, no top-level collision (re-check; UI is advisory). Filters the tree by the keep-list. Inside one transaction:
    1. Insert new `service_categories` rows (salon-scoped).
    2. Insert new `service_families` rows under those categories.
    3. Insert new `services` rows under those families, copying duration / price / color / description from the preset, applying `kind = 'standard'`.
    4. Insert a `preset_applications` row with the inserted variant ids.
  - Reply `{ importedVariantIds: string[], importedCategoryIds: string[] }` so the UI can highlight them post-apply.
- Tenant resolution and auth: reuse the existing tenant-request helper used by `/api/services`.

**Exit criteria:** `curl`-driven smoke test creates a salon, picks the placeholder preset, sees rows in `services` / `service_families` / `service_categories` and an audit row in `preset_applications`. Re-applying the same preset is blocked by the collision check.

---

## Phase 3 — Picker UI + integration

**Goal:** the manager-facing experience, reused in two places.

- `apps/app/components/catalog-preset-picker.tsx` (working name) — a controlled component:
  - Gallery view: cards for each preset, disabled ones greyed out with `disabledReason` shown.
  - Selecting a card → preview tree (دسته/گروه/خدمت) with checkboxes, all on by default, expandable.
  - Apply button → POSTs to `[id]/apply`, calls `onApplied({ importedCategoryIds, importedVariantIds })`.
  - Post-apply hint copy: "می‌توانید قیمت و جزئیات هر خدمت را بعداً از بخش خدمات تغییر دهید."
- Onboarding (`apps/app/app/(app)/onboarding/page.tsx`):
  - Replace `ServiceStep`'s single-service form with the picker as the **primary** path.
  - Keep a "ساخت دستی" toggle that swaps in the current single-service form for power users.
  - Onboarding completion gate (`servicesAdded`) at `page.tsx:872` works unchanged — it counts any `services` row.
- Catalog management screen — locate the existing services management page (likely under `apps/app/app/(app)/settings/services` or similar; resolve at implementation time). Add an "افزودن از قالب آماده" button that opens the picker in a sheet/modal. On success, scroll to / highlight the newly imported دسته rows using `importedCategoryIds`.

**Exit criteria:** new salon completes onboarding via the picker alone; existing salon adds a second preset later (or sees it disabled when collision exists).

---

## File map (estimated)

```
packages/salon-core/src/forms/catalog-preset.ts                   (new)
packages/database/src/schema.ts                                   (edit)
packages/database/src/migrations/0017_catalog_presets.sql         (new)
packages/database/src/seed/catalog-presets.ts                     (new)
apps/app/app/api/catalog-presets/route.ts                         (new)
apps/app/app/api/catalog-presets/[id]/apply/route.ts              (new)
apps/app/components/catalog-preset-picker.tsx                     (new)
apps/app/app/(app)/onboarding/page.tsx                            (edit — ServiceStep)
apps/app/app/(app)/<catalog management path>/page.tsx             (edit)
CONTEXT.md                                                        (already updated)
```

---

## Risks / things to verify during Phase 1

- Whether `packages/data-client` projects the catalog tree for offline use — if yes, the picker's "post-apply highlight" needs to round-trip through the projection, not just the SWR cache.
- Whether `staff_services` (catalog of which staff can perform which خدمت) needs default rows on import. The schema comment at `schema.ts:303` says "no rows = can do everything" — so doing nothing is correct, but worth confirming the UI doesn't degrade.
- Whether `service_public_visibility` needs default rows for imported خدمت — likely default-visible by absence; confirm.
- Whether the onboarding `salon_onboarding.servicesAdded` flag is computed live from `count(services) > 0` or stored — affects whether picker apply needs to nudge anything.
