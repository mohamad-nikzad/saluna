---
id: BL-0070
title: Capture structured Salon Presence location
status: done
type: task
triage: ready-for-agent
priority: high
size: large
parent: BL-0069
blocked_by: []
created: 2026-07-26
updated: 2026-07-27
---

## Parent

[BL-0069 Improve public Salon pages for local organic search](../ready/BL-0069-improve-public-salon-local-seo.md)

## What to Build

Let managers and authorized platform staff record a Salon's province, city,
and optional neighborhood alongside its existing street address wherever Salon
Presence is edited. Persist and expose the fields through the existing Salon
Presence contracts so they remain the single source of truth for later public
page and search output.

Province and city choices come from a reviewed Iran province → city snapshot
committed to the repository; forms do not fetch location choices at runtime.
Use canonical Persian names as the persisted Presence values and retain the
snapshot's source date, source reference, and source codes as data provenance.
The snapshot must use a source whose redistribution terms are acceptable for
this repository.

Use searchable cascading pickers in both Presence forms. Reuse the PWA's
existing `ResponsivePicker` + `Command` interaction: a keyboard-aware drawer on
touch devices and a constrained popover otherwise. Province is available first;
city is enabled and filtered after province selection. Neighborhood remains
optional and accepts free text because no verified, complete nationwide
city → neighborhood registry was found. It may offer reviewed city-specific
suggestions, but a missing suggestion must never prevent entering a real
neighborhood.

## Acceptance Criteria

- [x] Salon Presence stores nullable province, city, and neighborhood values without changing the meaning of the existing address field.
- [x] Existing Salons and published public pages continue to work when every new location field is empty.
- [x] Manager and Assisted Salon Setup Presence forms load, edit, save, clear, and redisplay all three fields.
- [x] The repository contains a reviewed local snapshot covering all 31 Iranian provinces and their city choices, with its source date, exact source reference, original source codes, and redistribution basis documented; location pickers make no runtime third-party request.
- [x] Snapshot review excludes statistical sub-city rows such as `تهران 1` through `تهران 22` without dropping valid multi-word city names.
- [x] Province and city use searchable, clearable pickers; Persian search also matches Arabic `ي/ك` variants as Persian `ی/ک`.
- [x] City is disabled until province is selected and shows only that province's cities.
- [x] Changing or clearing province clears city and neighborhood; changing or clearing city clears neighborhood.
- [x] Neighborhood is an optional searchable, free-entry combobox. Reviewed city-scoped suggestions may be shown, but managers and platform staff can save a value absent from the suggestion list.
- [x] Touch devices use the established mobile drawer picker with touch-sized choices, while pointer devices use the established popover behavior; both retain accessible labels, empty states, and keyboard interaction.
- [x] Inputs are trimmed, empty values become null, and reasonable length limits reject invalid values consistently at the shared validation boundary.
- [x] Authenticated Salon Presence API schemas and the generated client expose the new fields without introducing separate SEO-owned copies.
- [x] Focused checks cover snapshot integrity, province → city filtering, dependent-field clearing, Persian search normalization, and custom neighborhood entry.
- [x] Existing Salon Presence validation, persistence, authorization, and form behavior remains green.

## Data and UX Research

See [Iran province, city, and neighborhood data](../../docs/research/iran-location-data.md).
The SCI 1402 mirror is the freshest candidate found, but its generated city
output includes statistical sub-city rows and its redistribution basis must be
confirmed before copying it. Older MIT-licensed datasets are useful for
cross-checking but are too stale to present unchanged as the current national
list.

OpenStreetMap can support a later, explicitly attributed and reviewed
per-city neighborhood suggestion snapshot. Its community coverage, variable
city relationships, and ODbL obligations make it unsuitable as a
claimed-complete nationwide neighborhood select in this task.

## Out of Scope

- Runtime province, city, or neighborhood lookups from third-party services.
- Claiming complete nationwide neighborhood coverage.
- A new location taxonomy database, country selector, map picker, coordinates,
  or boundary storage.
- A new picker dependency or a second SEO-owned copy of location values.

## Blocked By

None — can start immediately.
