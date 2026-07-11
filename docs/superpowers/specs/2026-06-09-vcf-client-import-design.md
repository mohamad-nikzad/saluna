# VCF Client Bulk Import — Design Spec

**Date:** 2026-06-09  
**Status:** Approved  
**Scope:** PWA clients page (`apps/pwa`) + bulk API (`apps/api`) + shared parser (`packages/salon-core`)

## Problem

New salon users must add clients one-by-one via `ClientDrawer`. Many already have contacts exported as `.vcf` (vCard) from their phone. We need bulk import with a review step so users control what gets added.

## Goals

- Import clients from a `.vcf` file on the PWA clients page
- Parse and preview entirely client-side (contacts stay on device until submit)
- Show only importable contacts in the preview list; report filtered-out counts as info
- Normalize phone numbers to the salon canonical format (`normalizePhone`)
- Allow inline edit of name/phone in preview before submit
- Add a bulk create API endpoint with partial-success semantics

## Non-goals (v1)

- Native app support
- CSV or device contacts API integration
- Importing VCF `NOTE`, tags, or other fields
- Offline mutation queue for bulk import
- Server-side VCF upload/parsing

## User flow

1. User opens **مشتریان** (`/_authed/clients/`).
2. Taps header button **«افزودن گروهی با فایل»** (secondary/outline, compact).
3. Native file picker opens (`accept=".vcf,text/vcard"`).
4. App reads file text, parses VCF, classifies each card, normalizes phones.
5. Full-height `FormSheet` opens with:
   - Summary info bar (counts)
   - Search + select-all
   - List of **importable-only** rows (checkbox + editable name + editable phone)
6. User edits/selects rows, taps **«افزودن N مشتری»**.
7. Client re-validates checked rows, calls `POST /api/v1/clients/bulk`.
8. Toast summarizes result; clients list refreshes; sheet closes.

The existing `+` FAB continues to open `ClientDrawer` for single-client add.

## UI

### Entry point

Add to `clients.index.tsx` header row (opposite title block):

```
[ مشتریان ]                    [ افزودن گروهی با فایل ]
۱۲ مشتری فعال
```

### Import sheet

Reuse `FormSheet` shell (same pattern as `ClientDrawer` and catalog preset picker).

| Area     | Content                                                              |
| -------- | -------------------------------------------------------------------- |
| Title    | «ورود از فایل مخاطبین»                                               |
| Info bar | Sticky summary counts (see below)                                    |
| Toolbar  | Search (name/phone) + «انتخاب همه»                                   |
| List     | Checkbox + inline name input + inline phone input per importable row |
| Footer   | «افزودن N مشتری» — disabled when N = 0                               |

### Phone input in preview rows

Match `ClientDrawer`:

- Display: `displayPhone(value)`
- On change: `normalizePhone(raw)`
- `dir="ltr"`, `type="tel"`
- Re-validate on blur with `phoneSchema`

### Summary info bar

Always visible below sheet header. Examples:

- `۱۲ مخاطب در فایل · ۸ قابل افزودن · ۲ تکراری · ۲ نامعتبر`
- All importable: `۱۲ مخاطب · همه قابل افزودن`
- None importable: `هیچ مخاطب قابل افزودنی در فایل نیست` + action to pick another file

Invalid and duplicate contacts are **not** listed — only counted here.

### Post-submit toast

Mirror info-bar tone:

- `۸ مشتری اضافه شد`
- `۶ اضافه شد · ۲ تکراری نادیده گرفته شد`

## VCF parsing (`@repo/salon-core`)

New module: `packages/salon-core/src/vcf.ts` (or `vcf/parse.ts`) with unit tests.

### Input / output

```ts
type VcfDraftContact = {
  localId: string
  name: string
  phoneRaw: string | null
  phone: string | null // after normalizePhone; null if missing
}

function parseVcfFile(text: string): VcfDraftContact[]
```

### Parsing rules

| Rule           | Behavior                                                          |
| -------------- | ----------------------------------------------------------------- |
| Card split     | `BEGIN:VCARD` … `END:VCARD`                                       |
| Folded lines   | Unfold RFC continuations (leading space/tab on continuation line) |
| Name           | `FN` first; fallback structured `N` (compose given + family)      |
| Phone          | Prefer `TEL` with `TYPE=CELL` or `TYPE=MOBILE`; else first `TEL`  |
| Strip prefix   | Remove `tel:`, spaces, punctuation before normalize               |
| Normalize      | `normalizePhone(tel)` — Persian/Arabic digits → Latin digits only |
| No name        | Card → **invalid** bucket (not shown)                             |
| No / bad phone | Card → **invalid** bucket after `phoneSchema` fails               |

### Classification (client-side)

After parse, each card is classified using loaded salon clients (`clientsListQueryOptions`):

```ts
type ImportRowStatus =
  | 'importable'
  | 'invalid'
  | 'duplicate-existing'
  | 'duplicate-file'

type ClientImportPreviewRow = {
  localId: string
  name: string
  phone: string
  status: 'importable' // only these enter the preview list
  selected: boolean
}
```

| Bucket            | Criteria                                                          | In preview list?          |
| ----------------- | ----------------------------------------------------------------- | ------------------------- |
| Importable        | Valid name + passes `phoneSchema` + unique in file + not in salon | Yes                       |
| Invalid           | Missing name, missing phone, or fails `phoneSchema`               | No — counted in info bar  |
| Duplicate (salon) | Normalized phone matches existing client                          | No — counted              |
| Duplicate (file)  | Second+ row with same normalized phone in file                    | No — counted (first wins) |

Re-validation on blur: if user edits a row to invalid, remove from list and update counts. If user fixes an invalid pattern… wait — invalid rows aren't in the list. So only importable rows can be edited; editing can demote a row out of the list (invalid) or if they fix phone that was duplicate... duplicates aren't in list so user can't fix those in preview. That's by design per UX decision.

### Pre-submit validation

Immediately before API call:

1. Re-run `requiredTextSchema` + `phoneSchema` on every checked row
2. Drop any that fail (update counts, don't send)
3. If zero rows remain, block submit

This minimizes backend `invalid` skips.

## Bulk API

### Endpoint

`POST /api/v1/clients/bulk`

- Auth: `manage_clients` (same middleware as `/api/v1/clients`)
- OpenAPI route + schema in `apps/api/src/openapi/`

### Request

```ts
{
  clients: Array<{
    name: string
    phone: string // canonical digits, pre-normalized
  }>
}
```

Constraints:

- `clients.length` ≥ 1 and ≤ `MAX_BULK_CLIENTS` (200)
- Per-item validation via shared zod schema (same rules as single create, without `tags` / `notes` / `id`)

### Response (partial success)

```ts
{
  created: Client[]
  skipped: Array<{
    phone: string
    reason: 'duplicate-phone' | 'invalid'
  }>
}
```

### Server behavior

1. Validate request body
2. For each client in order:
   - Normalize phone via `normalizePhone` (defense in depth)
   - Call existing `createClient({ salonId, name, phone })`
   - On duplicate unique index → append to `skipped` with `duplicate-phone`, continue
   - On validation failure → append to `skipped` with `invalid`, continue
3. Return `{ created, skipped }` in one response (single transaction optional; per-row continue is required)

New database helper: `createClientsBulk(salonId, clients)` in `packages/database/src/internal/client-queries.ts`.

### Client mutation

- `useBulkCreateClientsMutation()` in `apps/pwa/src/lib/clients-queries.ts`
- Invalidate `getApiV1ClientsQueryKey()` on success
- Regenerate API client types after OpenAPI update

## Edge cases

| Case                         | Behavior                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| Empty file / no VCARD blocks | Toast: `فایل مخاطبین خالی است` — stay on file-pick step               |
| Invalid file (not VCF)       | Toast: `فایل انتخاب‌شده معتبر نیست`                                   |
| > 200 importable rows        | Show first 200 in preview; info bar: `فقط ۲۰۰ مورد اول نمایش داده شد` |
| All filtered out             | Empty list, disabled submit, offer re-pick                            |
| Race duplicate on submit     | Backend `skipped.duplicate-phone`; reflected in toast                 |
| Network error                | Standard mutation error toast                                         |

## Testing

### Unit (`salon-core`)

- VCF parser: folded lines, multiple cards, FN/N fallback, TEL preference, Persian digits, `+98` prefix
- Classification: importable / invalid / duplicate-existing / duplicate-file buckets
- Info bar count aggregation

### API

- Bulk create: all success, partial duplicate skip, empty array → 400, over limit → 400
- Permission: 401/403 without `manage_clients`

### E2E (optional)

- Fixture `.vcf` → preview count → submit → clients list grows

## Implementation notes

- Follow existing PWA patterns: `FormSheet`, `Checkbox`, `clients-queries`, generated API client
- Parser lives in `salon-core` for testability; PWA owns UI state
- No new DB columns or migrations
- Unique index `clients_salon_id_phone_unique` already enforces duplicate skip server-side

## Related code

- `apps/pwa/src/routes/_authed/clients.index.tsx` — entry button
- `apps/pwa/src/components/clients/client-drawer.tsx` — phone input pattern
- `apps/pwa/src/components/catalog-preset-picker.tsx` — checkbox selection pattern
- `apps/api/src/routes/clients.ts` — existing single create
- `packages/salon-core/src/phone.ts` — `normalizePhone`
- `packages/salon-core/src/forms/primitives.ts` — `phoneSchema`
