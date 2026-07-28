# Iran province, city, and neighborhood data

Research date: 2026-07-27  
Scope: local bundled data and searchable, mobile-friendly inputs for BL-0070.

## Recommendation

Bundle a reviewed province → city snapshot in the repository, derived once from
[hamidrezaramzani/iran-locations-api](https://github.com/hamidrezaramzani/iran-locations-api)
`public/iran_cities_with_coordinates.json`. Persist only canonical Persian
province and city names in the existing Salon Presence string fields.

Keep neighborhood as optional free text in the first release. There is no
verified authoritative nationwide neighborhood registry: neighborhood names and
boundaries are maintained locally by municipalities. A searchable picker may
offer city-specific suggestions later, but it must continue to accept a value
not in the suggestion list.

Use the existing PWA `ResponsivePicker` + `Command` pattern: drawer on touch
devices, popover on pointer devices, searchable list in both. No new UI
dependency is needed.

## Data sources

| Candidate | Coverage and provenance | License / risk | Decision |
| --- | --- | --- | --- |
| [hamidrezaramzani/iran-locations-api](https://github.com/hamidrezaramzani/iran-locations-api) `iran_cities_with_coordinates.json` | 31 provinces with a curated city list plus optional metadata (ids, center, coordinates, landline prefixes, car plates). | [GPL-3.0](https://github.com/hamidrezaramzani/iran-locations-api/blob/main/LICENSE). | Selected snapshot source. Keep only Persian province/city names after cleanup. |
| [sajaddp/list-of-cities-in-Iran](https://github.com/sajaddp/list-of-cities-in-Iran) | Mirrors the SCI geographic classification through 1402 SH. Much larger city coverage, including statistical sub-city rows. | GPL-3.0; official SCI reuse terms unverified. | Previously used; replaced in favor of the curated coordinates dataset above. |
| [Hameds/IranCountryDivisions](https://github.com/Hameds/IranCountryDivisions) | Directly normalizes the SCI 1398 spreadsheet into Persian-normalized CSV/JSON/SQL. | MIT, but data is from 1398 SH (2019/20). | Useful cross-check only. |
| [arastu/iran](https://github.com/arastu/iran) | Scraped former Ministry of Interior administrative-division tables. | MIT, but last updated in 2020. | Do not use as the primary snapshot. |
| [GeoNames](https://download.geonames.org/export/dump/) | Daily gazetteer with coordinates and Persian alternate names. | CC BY 4.0; mixes legal cities and other populated places. | Useful for aliases or cross-checks, not as the picker source of truth. |

### Required import review

- Drop fields unused by Presence pickers: `id`, `center`, `latitude`,
  `longitude`, `landlinePrefix`, and `carLicencePlates`. Coordinates are out of
  scope for Presence storage and the upstream file has swapped lat/lng values
  for some cities.
- Normalize Arabic `ي/ك` to Persian `ی/ک`, deduplicate city names within each
  province, and normalize `چهارمحال بختیاری` to `چهارمحال و بختیاری`.
- Record the exact upstream file URL and commit in the snapshot `source` block.

## Neighborhoods

Iran's administrative hierarchy is province, county, district, city/rural
district, and settlement. The published text of the
[Law on Definitions and Rules of National Divisions](https://nezamat.ir/post-16280/)
states that city-neighborhood boundaries follow municipal divisions. That
explains why the SCI national table is not a nationwide city → neighborhood
registry.

[OpenStreetMap's Iran extract](https://download.geofabrik.de/asia/iran.html) is
updated daily and contains community-mapped `place=neighbourhood`,
`place=suburb`, and `place=quarter` features. Its own
[neighborhood definition](https://wiki.openstreetmap.org/wiki/Tag%3Aplace%3Dneighbourhood)
allows uncertain boundaries and node-only places. Coverage and city-parent
relationships therefore vary, and reuse requires ODbL attribution/share-alike
compliance. It is suitable only for an explicitly attributed, reviewed
per-city suggestion snapshot, not a claimed-complete national select.

## UI behavior

The repository already has the intended mobile interaction in
[`ResponsivePicker`](../../apps/pwa/src/components/responsive-picker.tsx):
a keyboard-aware drawer for touch devices and a constrained popover otherwise.
Existing service and staff pickers compose it with the shared `Command`
primitives for search and selection.

`cmdk` supports a controlled search input, custom filtering, empty states, and
use inside a Radix popover in its [primary documentation](https://github.com/dip/cmdk#use-inside-popover).
This matches the W3C's
[editable combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/),
where typing filters a predefined set of location values.

Recommended dependency behavior:

1. Province is searchable and always enabled.
2. City is disabled until province is selected and only shows that province's
   reviewed cities.
3. Changing or clearing province clears city and neighborhood; changing or
   clearing city clears neighborhood.
4. Neighborhood is an optional searchable text input. Suggestions, when
   available for that city, do not restrict arbitrary valid text.
5. All three fields remain clearable and use the shared touch-size and
   accessible-label conventions.

