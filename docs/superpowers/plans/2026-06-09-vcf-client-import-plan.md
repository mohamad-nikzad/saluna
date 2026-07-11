# VCF Client Bulk Import — Implementation Plan

**Date:** 2026-06-09  
**Design spec:** [`../specs/2026-06-09-vcf-client-import-design.md`](../specs/2026-06-09-vcf-client-import-design.md)  
**Estimated slices:** 5 vertical tasks (can be PR'd independently where noted)

## Read before starting

- Design spec (linked above)
- `apps/pwa/src/components/clients/client-drawer.tsx` — phone input pattern
- `apps/pwa/src/components/catalog-preset-picker.tsx` — checkbox selection pattern
- `apps/api/src/routes/clients.ts` + `apps/api/src/routes/clients.test.ts`
- `packages/database/src/internal/client-queries.ts`
- `packages/salon-core/src/phone.ts`, `packages/salon-core/src/forms/primitives.ts`

## Task order

```text
Task 1  salon-core VCF parser + classifier (unit tests)
   ↓
Task 2  database bulk create helper
   ↓
Task 3  API bulk endpoint + OpenAPI + tests + codegen
   ↓
Task 4  PWA import sheet UI + mutation
   ↓
Task 5  Wire entry button on clients page + manual QA
```

Tasks 1–3 can ship as one backend/core PR. Task 4–5 is the PWA PR (depends on Task 3 codegen).

---

## Task 1 — VCF parser & import classifier (`@repo/salon-core`)

### 1.1 Add VCF parser

**File:** `packages/salon-core/src/vcf.ts`

```ts
export type VcfDraftContact = {
  localId: string
  name: string
  phoneRaw: string | null
  phone: string | null
}

export function parseVcfFile(text: string): VcfDraftContact[]
```

**Implementation checklist:**

- [ ] Split on `BEGIN:VCARD` / `END:VCARD` (case-insensitive)
- [ ] Unfold lines per RFC 2425 (continuation lines start with space/tab)
- [ ] Parse `FN` for display name
- [ ] Fallback `N`: structured `Family;Given;...` → compose readable name
- [ ] Collect all `TEL` values; prefer `TYPE=CELL` or `TYPE=MOBILE` (case-insensitive), else first `TEL`
- [ ] Strip `tel:` URI prefix before normalize
- [ ] Apply `normalizePhone` to chosen TEL
- [ ] Skip cards with empty/whitespace name (they become invalid at classify stage)
- [ ] Generate `localId` with `crypto.randomUUID()` per card

**File:** `packages/salon-core/src/vcf.test.ts`

Fixture-based tests:

- [ ] Single card with `FN` + `TEL;TYPE=CELL`
- [ ] Multiple cards in one file
- [ ] Folded line continuation
- [ ] `N` fallback when no `FN`
- [ ] Persian digit phone `TEL:۰۹۱۲…` → `0912…`
- [ ] `TEL:+98912…` normalization
- [ ] Prefer CELL over HOME when both present
- [ ] Empty file → `[]`
- [ ] Card without TEL → `phone: null`

### 1.2 Add classifier + summary types

**File:** `packages/salon-core/src/client-import.ts`

```ts
export const MAX_BULK_CLIENTS = 200

export type ClientImportCounts = {
  totalInFile: number
  importable: number
  invalid: number
  duplicateExisting: number
  duplicateInFile: number
  truncated: boolean // true when importable > MAX_BULK_CLIENTS
}

export type ClientImportPreviewRow = {
  localId: string
  name: string
  phone: string
  selected: boolean
}

export type ClientImportPreview = {
  counts: ClientImportCounts
  rows: ClientImportPreviewRow[] // importable only, max MAX_BULK_CLIENTS
}

export function buildClientImportPreview(
  drafts: VcfDraftContact[],
  existingPhones: ReadonlySet<string>,
): ClientImportPreview
```

**Classification rules (in order per card):**

1. No name (trimmed empty) → `invalid`
2. No phone or `phoneSchema.safeParse` fails → `invalid`
3. Phone in `existingPhones` → `duplicateExisting`
4. Phone already seen in this file → `duplicateInFile` (first occurrence wins → importable if passes 1–2)
5. Else → `importable`

**Row list:** only importable cards, capped at `MAX_BULK_CLIENTS`, all `selected: true` by default.

**File:** `packages/salon-core/src/client-import.test.ts`

- [ ] Mixed buckets produce correct counts
- [ ] File duplicate: first importable, second `duplicateInFile`
- [ ] Salon duplicate via `existingPhones`
- [ ] Invalid phone short-circuits before duplicate check
- [ ] Truncation at 200 importable sets `truncated: true`

### 1.3 Add bulk request schema

**File:** `packages/salon-core/src/forms/client.ts` (extend existing)

```ts
export const clientBulkCreateItemSchema = z.object({
  name: requiredTextSchema,
  phone: phoneSchema,
})

export const clientBulkCreateSchema = z.object({
  clients: z
    .array(clientBulkCreateItemSchema)
    .min(1, 'حداقل یک مشتری لازم است')
    .max(MAX_BULK_CLIENTS, `حداکثر ${MAX_BULK_CLIENTS} مشتری در هر درخواست`),
})
```

Add tests in `client.test.ts` for min/max array bounds.

### 1.4 Verify

```bash
pnpm --filter @repo/salon-core test
pnpm --filter @repo/salon-core typecheck
```

---

## Task 2 — Database bulk create helper

**File:** `packages/database/src/internal/client-queries.ts`

```ts
export type BulkCreateClientInput = { name: string; phone: string }
export type BulkCreateClientSkipped = {
  phone: string
  reason: 'duplicate-phone' | 'invalid'
}
export type BulkCreateClientsResult = {
  created: Client[]
  skipped: BulkCreateClientSkipped[]
}

export async function createClientsBulk(
  salonId: string,
  clients: BulkCreateClientInput[],
): Promise<BulkCreateClientsResult>
```

**Behavior:**

- [ ] Loop `clients` in order (no wrapping transaction — partial success required)
- [ ] Per row: validate name non-empty + phone via same rules as `createClient`
- [ ] Call existing `createClient({ salonId, name, phone })`
- [ ] Catch duplicate errors (`isDuplicatePhoneError` pattern from route) → push `{ phone, reason: 'duplicate-phone' }`, continue
- [ ] Catch validation issues → push `{ phone, reason: 'invalid' }`, continue
- [ ] Accumulate `created` array

**File:** `packages/database/src/clients.ts`

- [ ] Re-export `createClientsBulk` and result types

**Verify:** covered by API route tests (Task 3); optional dedicated unit test if cheap to add with mocked DB.

---

## Task 3 — API bulk endpoint

### 3.1 OpenAPI schemas

**File:** `apps/api/src/openapi/schemas/clients.ts`

- [ ] `clientBulkCreateItemSchemaOpenApi` from `clientBulkCreateItemSchema`
- [ ] `clientBulkCreateBodySchemaOpenApi` from `clientBulkCreateSchema`
- [ ] `clientBulkSkippedSchema` — `{ phone, reason: enum }`
- [ ] `clientBulkCreateResponseSchema` — `{ created: Client[], skipped: [...] }`

### 3.2 OpenAPI route

**File:** `apps/api/src/openapi/routes/clients.ts`

```ts
export const bulkCreateClientsRoute = createRoute({
  method: 'post',
  path: '/bulk',
  tags: ['Clients'],
  summary: 'Bulk create clients',
  security: tenantSecurity,
  request: { body: { required: true, content: { ... } } },
  responses: {
    200: { description: 'Partial or full success', ... },
    400: validationErrorResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
})
```

### 3.3 Route handler

**File:** `apps/api/src/routes/clients.ts`

- [ ] Import `createClientsBulk`, `bulkCreateClientsRoute`
- [ ] Handler: read `salonId` from tenant, validate body, call `createClientsBulk`, return `jsonSerialized({ created, skipped })`
- [ ] Chain `.openapi(bulkCreateClientsRoute, bulkCreateClientsHandler)`

**File:** `apps/api/src/openapi/contract-app.ts`

- [ ] Import route + add stub handler
- [ ] Register on `/api/v1/clients` sub-app (alongside existing routes)

### 3.4 API tests

**File:** `apps/api/src/routes/clients.test.ts`

Extend mocks:

```ts
vi.mock('@repo/database/clients', () => ({
  ...
  createClientsBulk: vi.fn(),
}))
```

Tests:

- [ ] `POST /api/v1/clients/bulk` 401 without auth
- [ ] 400 on empty `clients` array
- [ ] 400 on > 200 items
- [ ] 200 with `{ created, skipped }` shape from mocked `createClientsBulk`

### 3.5 Regenerate API client

```bash
pnpm generate:api-contract
pnpm generate:api-client
```

Confirm new exports:

- `postApiV1ClientsBulk` (SDK)
- `postApiV1ClientsBulkMutation` (query)
- Types `ClientBulkCreateRequest`, `ClientBulkCreateResponse`

### 3.6 Verify

```bash
pnpm --filter @repo/api test
pnpm --filter @repo/api typecheck
```

---

## Task 4 — PWA import sheet

### 4.1 Classification hook (client-side)

**File:** `apps/pwa/src/lib/client-import.ts`

Thin wrapper re-exporting salon-core `parseVcfFile`, `buildClientImportPreview`, types.

Helper:

```ts
export function formatImportCounts(counts: ClientImportCounts): string
```

Persian copy examples:

- `۱۲ مخاطب در فایل · ۸ قابل افزودن · ۲ تکراری · ۲ نامعتبر`
- `۱۲ مخاطب · همه قابل افزودن`
- Append ` · فقط ۲۰۰ مورد اول نمایش داده شد` when `truncated`

Use `toPersianDigits` for numbers.

### 4.2 Bulk mutation

**File:** `apps/pwa/src/lib/clients-queries.ts`

```ts
export function useBulkCreateClientsMutation()
```

- [ ] Use generated `postApiV1ClientsBulkMutation`
- [ ] `meta.invalidatesQuery: getApiV1ClientsQueryKey()`
- [ ] `meta.skipToast: true` (custom success toast in component)

**File:** `apps/pwa/src/lib/client-import-toast.ts`

```ts
export function formatBulkImportToast(created: number, skipped: number): string
```

- `۸ مشتری اضافه شد`
- `۶ اضافه شد · ۲ تکراری نادیده گرفته شد`

### 4.3 Import sheet component

**File:** `apps/pwa/src/components/clients/client-import-sheet.tsx`

**Props:**

```ts
{
  open: boolean
  onOpenChange: (open: boolean) => void
  existingClients: Client[]
  onSuccess: () => void
}
```

**State machine:**

1. **Closed** — parent controls `open`
2. **File pick** — hidden `<input type="file" accept=".vcf,text/vcard">` triggered by parent button before opening sheet, OR ref-based `pickFile()` called from parent
3. **Preview** — sheet open with rows

**Recommended flow:** Parent header button triggers file input → on file read success, set preview state and open sheet. On parse error, toast and don't open sheet.

**Preview UI (FormSheet):**

- [ ] Title: «ورود از فایل مخاطبین»
- [ ] Info bar: `formatImportCounts(counts)` — sticky below header
- [ ] Search input filters visible rows by name/phone substring
- [ ] «انتخاب همه» checkbox toggles all visible rows' `selected`
- [ ] Row: `Checkbox` + `Input` name + `Input` phone (ClientDrawer phone pattern)
- [ ] On name/phone blur: re-validate row; if invalid, remove from list and recompute counts (call a `revalidateRow` helper)
- [ ] Empty importable list: message + «انتخاب فایل دیگر» button
- [ ] Footer: «افزودن N مشتری» — `N` = selected count among visible rows; disabled when 0

**Submit:**

- [ ] Collect selected rows
- [ ] Re-run `clientBulkCreateItemSchema` per row; drop failures silently (should be rare)
- [ ] `bulkCreate.mutateAsync({ clients })`
- [ ] Show `formatBulkImportToast` via toast utility used elsewhere in PWA
- [ ] `onSuccess()` → close sheet, parent invalidates list

**File read errors:**

- No `BEGIN:VCARD` → toast `فایل انتخاب‌شده معتبر نیست`
- Zero cards → toast `فایل مخاطبین خالی است`

### 4.4 Unit tests

**File:** `apps/pwa/src/lib/client-import.test.ts`

- [ ] `formatImportCounts` Persian strings
- [ ] `formatBulkImportToast` variants

Optional component test for row removal on invalid blur.

### 4.5 Verify

```bash
pnpm --filter @repo/pwa test
pnpm --filter @repo/pwa typecheck
```

---

## Task 5 — Wire clients page entry point

**File:** `apps/pwa/src/routes/_authed/clients.index.tsx`

- [ ] Add hidden file input + ref (or encapsulate in `ClientImportSheet`)
- [ ] Header row: add `Button variant="outline" size="sm"` — «افزودن گروهی با فایل»
- [ ] On click → trigger file picker
- [ ] Mount `<ClientImportSheet open={...} existingClients={clients} onSuccess={invalidate} />`
- [ ] Keep existing FAB → `ClientDrawer` unchanged

**Layout:** flex header with title block `flex-1` and button `shrink-0` aligned to start (RTL: button on visual left / inline-end).

### Manual QA checklist

- [ ] Pick valid `.vcf` with 3 contacts → info bar counts correct, 3 rows selected
- [ ] File with duplicate of existing salon client → duplicate counted, not listed
- [ ] File with two same phones → second counted as duplicate-in-file
- [ ] Invalid phone in file → invalid counted, not listed
- [ ] Edit row phone to invalid on blur → row disappears, invalid count increases
- [ ] Search filters rows
- [ ] Select-all toggles visible rows
- [ ] Submit adds clients; list refreshes; toast correct
- [ ] Submit with race duplicate → partial toast
- [ ] File > 200 importable → truncation message
- [ ] Dark mode: sheet readable
- [ ] Mobile: sheet scrollable, footer pinned

---

## File manifest (new / modified)

| File                                                      | Action    |
| --------------------------------------------------------- | --------- |
| `packages/salon-core/src/vcf.ts`                          | New       |
| `packages/salon-core/src/vcf.test.ts`                     | New       |
| `packages/salon-core/src/client-import.ts`                | New       |
| `packages/salon-core/src/client-import.test.ts`           | New       |
| `packages/salon-core/src/forms/client.ts`                 | Extend    |
| `packages/salon-core/src/forms/client.test.ts`            | Extend    |
| `packages/database/src/internal/client-queries.ts`        | Extend    |
| `packages/database/src/clients.ts`                        | Re-export |
| `apps/api/src/openapi/schemas/clients.ts`                 | Extend    |
| `apps/api/src/openapi/routes/clients.ts`                  | Extend    |
| `apps/api/src/routes/clients.ts`                          | Extend    |
| `apps/api/src/openapi/contract-app.ts`                    | Extend    |
| `apps/api/src/routes/clients.test.ts`                     | Extend    |
| `packages/api-contract/openapi.json`                      | Generated |
| `packages/api-client/src/generated/*`                     | Generated |
| `apps/pwa/src/lib/client-import.ts`                       | New       |
| `apps/pwa/src/lib/client-import.test.ts`                  | New       |
| `apps/pwa/src/lib/client-import-toast.ts`                 | New       |
| `apps/pwa/src/lib/clients-queries.ts`                     | Extend    |
| `apps/pwa/src/components/clients/client-import-sheet.tsx` | New       |
| `apps/pwa/src/routes/_authed/clients.index.tsx`           | Extend    |

## PR strategy

**PR 1 — Core + API** (Tasks 1–3)

- Reviewable without UI
- Unblocks codegen for PWA

**PR 2 — PWA** (Tasks 4–5)

- Depends on PR 1 merged + codegen run

## Out of scope reminders

- Native app
- VCF notes/tags
- Server-side file upload
- Offline queue for bulk import
