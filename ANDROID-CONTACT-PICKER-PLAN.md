# Android Contact Picker — Implementation Plan

**Date:** 2026-06-10  
**ADR:** [`docs/adr/0005-android-contact-picker-for-client-import.md`](docs/adr/0005-android-contact-picker-for-client-import.md)  
**Domain terms:** [`CONTEXT.md`](CONTEXT.md) — Client, Device Contact, Client Import  
**Builds on:** VCF bulk import ([`docs/superpowers/specs/2026-06-09-vcf-client-import-design.md`](docs/superpowers/specs/2026-06-09-vcf-client-import-design.md))  
**Estimated slices:** 6 tasks (Tasks 1–2 can ship as one core PR; Tasks 3–6 as one or two PWA PRs)

## Summary

Add Android Contact Picker support for:

1. **Bulk** — `/clients/import`: primary «انتخاب از مخاطبین گوشی» → existing preview sheet → `POST /api/v1/clients/bulk`
2. **Single** — `ClientPicker` + `ClientDrawer` (create): pick one contact, resolve phone, create or link existing Client

No backend changes. No iOS support. Online-only PWA (no offline queue).

## Decisions (from design review)

| Topic                | Decision                                                |
| -------------------- | ------------------------------------------------------- |
| Visibility           | Feature-detect `navigator.contacts?.select`             |
| Bulk layout          | Phone-first hero; VCF guides under «ورود با فایل»       |
| Multi-phone (bulk)   | First `tel` that normalizes to valid salon phone        |
| Multi-phone (single) | Inline chooser when `tel.length > 1`                    |
| Fields               | Name + phone only                                       |
| Duplicate (picker)   | Auto-select existing Client by canonical phone          |
| Duplicate (drawer)   | Confirm dialog: link existing or cancel                 |
| Cancel / empty pick  | Silent no-op                                            |
| Copy                 | «افزودن گروهی», «ورود گروهی مشتریان», «از مخاطبین گوشی» |

## Read before starting

- ADR (linked above)
- `packages/salon-core/src/vcf.ts` — `VcfDraftContact`, phone selection pattern
- `packages/salon-core/src/client-import.ts` — `buildClientImportPreview`
- `apps/pwa/src/lib/use-client-import.ts` — bulk flow state machine
- `apps/pwa/src/components/clients/client-import-guides-accordion.tsx` — import landing UI
- `apps/pwa/src/components/calendar/client-picker.tsx` — search / add modes
- `apps/pwa/src/components/clients/client-drawer.tsx` — create form
- `apps/pwa/public/manifest.webmanifest`

## Task order

```text
Task 1  salon-core: map Contact Picker rows → VcfDraftContact (unit tests)
   ↓
Task 2  PWA: device-contacts util + feature detect + phone chooser helper
   ↓
Task 3  Bulk: manifest permission + import landing + useClientImport.pickFromDevice
   ↓
Task 4  Single: ClientPicker integration
   ↓
Task 5  Single: ClientDrawer integration + duplicate confirm
   ↓
Task 6  Copy pass + manual QA checklist
```

---

## Task 1 — Device contact mapper (`@repo/salon-core`)

### 1.1 Add mapper module

**File:** `packages/salon-core/src/device-contacts.ts`

```ts
export type DeviceContactPickerRow = {
  name?: string[]
  tel?: string[]
}

export function composeDeviceContactName(name?: string[]): string

export function chooseDeviceContactPhone(
  tels: string[] | undefined,
): string | null

export function mapDeviceContactsToDrafts(
  contacts: DeviceContactPickerRow[],
): VcfDraftContact[]
```

**Implementation checklist:**

- [ ] `composeDeviceContactName`: join `name[0]` trimmed; empty → `''`
- [ ] `chooseDeviceContactPhone`: iterate `tel` in order; strip `tel:` prefix; apply `canonicalSalonPhone`; return first valid salon phone (same intent as VCF `chooseTel`, without TYPE metadata)
- [ ] `mapDeviceContactsToDrafts`: one draft per picker row; `localId` via `crypto.randomUUID()`; `phone` from `chooseDeviceContactPhone`
- [ ] Do not read `email`, `address`, or `icon`

**File:** `packages/salon-core/src/device-contacts.test.ts`

- [ ] Single name + single valid mobile
- [ ] Multiple `tel` — picks first normalizable
- [ ] Persian digits / `+98` normalization
- [ ] Empty `tel` → `phone: null` (invalid at classify stage)
- [ ] Empty name → `name: ''`
- [ ] Multiple picker rows → multiple drafts with unique `localId`

### 1.2 Export

**File:** `packages/salon-core/src/index.ts`

- [ ] `export * from './device-contacts'`

### 1.3 Verify

```bash
pnpm --filter @repo/salon-core test
pnpm --filter @repo/salon-core typecheck
```

---

## Task 2 — PWA device-contacts utilities

### 2.1 Feature detection + picker wrapper

**File:** `apps/pwa/src/lib/device-contacts.ts`

```ts
export function isDeviceContactPickerSupported(): boolean

export async function pickDeviceContacts(options: {
  multiple: boolean
}): Promise<DeviceContactPickerRow[] | null>
```

**Implementation checklist:**

- [ ] `isDeviceContactPickerSupported`: `'contacts' in navigator && typeof navigator.contacts?.select === 'function'`
- [ ] `pickDeviceContacts`: call `navigator.contacts.select(['name', 'tel'], { multiple })` inside user gesture
- [ ] Return `null` on throw, missing API, or empty array (silent cancel — no toast)
- [ ] Map native result to `DeviceContactPickerRow[]` (defensive: treat missing arrays as empty)
- [ ] Type `navigator.contacts` via minimal ambient declaration in `apps/pwa/src/types/contact-picker.d.ts` (or colocated in the util file)

### 2.2 Phone resolution for single pick

**File:** `apps/pwa/src/lib/device-contacts.ts` (extend)

```ts
export type ResolvedDeviceContact =
  | { kind: 'ready'; name: string; phone: string }
  | { kind: 'choose-phone'; name: string; phones: string[] }
  | { kind: 'invalid'; name: string }

export function resolveSingleDeviceContact(
  row: DeviceContactPickerRow,
): ResolvedDeviceContact
```

- [ ] `choose-phone` when 2+ distinct normalizable phones
- [ ] `ready` when exactly one valid phone (or multiple tels but only one normalizes — use bulk rule)
- [ ] `invalid` when no normalizable phone

### 2.3 Find existing client by phone

**File:** `apps/pwa/src/lib/device-contacts.ts` (extend)

```ts
export function findClientByCanonicalPhone(
  clients: Client[],
  phone: string,
): Client | undefined
```

- [ ] Compare via `canonicalSalonPhone` on both sides

### 2.4 Shared phone chooser UI

**File:** `apps/pwa/src/components/clients/device-contact-phone-sheet.tsx`

Small `FormSheet` or drawer listing normalized phones (LTR) for single-pick multi-`tel` case.

- [ ] Props: `open`, `name`, `phones`, `onSelect`, `onOpenChange`
- [ ] Title: «کدام شماره؟»

### 2.5 Tests

**File:** `apps/pwa/src/lib/device-contacts.test.ts`

- [ ] `resolveSingleDeviceContact` cases (ready / choose-phone / invalid)
- [ ] `findClientByCanonicalPhone` match / no match
- [ ] Mock-free unit tests only (picker API tested manually)

---

## Task 3 — Bulk import integration

### 3.1 Manifest permission

**File:** `apps/pwa/public/manifest.webmanifest`

- [ ] Add top-level `"permissions": ["contacts"]`

### 3.2 Extend `useClientImport`

**File:** `apps/pwa/src/lib/use-client-import.ts`

- [ ] Import `pickDeviceContacts`, `mapDeviceContactsToDrafts` (via salon-core)
- [ ] Add `pickFromDevice` callback:
  1. `const rows = await pickDeviceContacts({ multiple: true })`
  2. If `null` or empty → return (silent)
  3. `const drafts = mapDeviceContactsToDrafts(rows)`
  4. If `drafts.length === 0` → toast «مخاطبی انتخاب نشد» (only if picker returned rows but all empty — edge case)
  5. `buildClientImportPreview(drafts, existingPhones)` → set preview (same as file path)

- [ ] Export `pickFromDevice` and `isDeviceContactPickerSupported` from hook or import detect directly in UI

### 3.3 Import landing UI — phone-first hero

**File:** `apps/pwa/src/components/clients/client-import-guides-accordion.tsx`

When `isDeviceContactPickerSupported()`:

- [ ] Sticky top section above search:
  - Primary button: «انتخاب از مخاطبین گوشی» → `onPickFromDevice`
  - Secondary outline/link: «ورود با فایل» — scrolls/focuses existing guides + file footer
- [ ] Update helper copy: remove «اول راهنما، بعد انتخاب فایل» when picker available; use «از مخاطبین گوشی یا فایل VCF»

When unsupported: keep current layout unchanged.

**File:** `apps/pwa/src/routes/_authed/clients.import.tsx`

- [ ] Pass `onPickFromDevice={importFlow.pickFromDevice}`
- [ ] Update header title: «ورود گروهی مشتریان»
- [ ] Update subtitle: preview step «پیش‌نمایش و انتخاب مشتریان»; landing step adapts to picker availability

### 3.4 Clients list entry copy

**File:** `apps/pwa/src/routes/_authed/clients.index.tsx`

- [ ] Link text: «افزودن گروهی» (was «افزودن گروهی با فایل»)

### 3.5 Verify

- [ ] Preview counts / submit path identical to VCF import
- [ ] `pnpm --filter pwa typecheck`

---

## Task 4 — `ClientPicker` single pick

**File:** `apps/pwa/src/components/calendar/client-picker.tsx`

### 4.1 UI

- [ ] In `searchingBody`, above client list footer: button «از مخاطبین گوشی» (only when supported)
- [ ] Icon: `Contact` or `UserRound` from lucide

### 4.2 Flow

1. User taps «از مخاطبین گوشی»
2. `pickDeviceContacts({ multiple: false })` → one row or cancel
3. `resolveSingleDeviceContact(row)`:
   - `choose-phone` → open `DeviceContactPhoneSheet` → on select continue with phone
   - `invalid` → toast «شماره معتبر یافت نشد»
4. `findClientByCanonicalPhone(clients, phone)`:
   - **Found** → `selectClient(existing.id)` (auto-link)
   - **Not found** → `reset` form with name/phone → `setMode('adding')` for review + save

- [ ] Wire phone sheet state locally in `ClientPicker`

### 4.3 Verify

- [ ] Existing search / manual add unchanged when picker unsupported
- [ ] Booking drawer still creates client on save via existing mutation

---

## Task 5 — `ClientDrawer` single pick (create only)

**File:** `apps/pwa/src/components/clients/client-drawer.tsx`

### 5.1 UI

- [ ] When `!isEditing && isDeviceContactPickerSupported()`, show «از مخاطبین گوشی» near top of form (outline button)

### 5.2 Flow

Same pick + resolve as Task 4, then:

- **Existing client** → `AlertDialog` from `@repo/ui/alert-dialog`:
  - Title: «این شماره قبلاً ثبت شده»
  - Body: `{existing.name} · {displayPhone(existing.phone)}`
  - Primary: «انتخاب همین مشتری» → `onExistingClientSelected?.(existing)` if prop provided, else close drawer + toast info; always `onOpenChange(false)`
  - Secondary: «انصراف» → close dialog only
- **Not found** → `reset` form with `{ name, phone }` (notes/tags empty)

### 5.3 Props

**File:** `apps/pwa/src/components/clients/client-drawer.tsx`

- [ ] Add optional `onExistingClientSelected?: (client: Client) => void` for callers that need a linked client (future calendar reuse); clients index can omit it

### 5.4 Phone sheet

- [ ] Reuse `DeviceContactPhoneSheet` from Task 2

---

## Task 6 — Copy pass + QA

### 6.1 Copy audit

| Location                          | New copy                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| `clients.index.tsx`               | «افزودن گروهی»                                                                          |
| `clients.import.tsx` header       | «ورود گروهی مشتریان»                                                                    |
| Import landing (picker available) | Hero + «ورود با فایل»                                                                   |
| Single pick buttons               | «از مخاطبین گوشی»                                                                       |
| Info bar `totalInFile` label      | Optional: «مخاطب» instead of «در فایل» when source was device (nice-to-have; can defer) |

### 6.2 Manual QA (Android Chrome)

**Environment:** Android device or emulator with Chrome; test both installed PWA and browser tab.

- [ ] `isDeviceContactPickerSupported()` true on Android Chrome
- [ ] Button hidden on iOS Safari / desktop Chrome
- [ ] Bulk: pick multiple contacts → preview counts → submit → clients list grows
- [ ] Bulk: cancel picker → no toast, stay on landing
- [ ] Bulk: duplicate phone → skipped in preview as `duplicateExisting`
- [ ] Bulk: VCF file path still works
- [ ] Picker: pick contact matching existing client → auto-selected on calendar
- [ ] Picker: pick new contact → add form prefilled → save → selected
- [ ] Picker: multi-`tel` contact → phone chooser → correct number used
- [ ] Drawer: create + pick existing phone → confirm dialog → appropriate close/toast
- [ ] Drawer: edit mode — no «از مخاطبین گوشی» button
- [ ] Installed PWA: picker works after manifest `contacts` permission

### 6.3 Automated tests

```bash
pnpm --filter @repo/salon-core test
pnpm --filter pwa test
pnpm --filter pwa typecheck
```

---

## Out of scope

- iOS / Contact Access Framework
- Email, notes, or tags from device contacts
- Offline queue for import or create
- Native app (`apps/native`)
- Renaming `totalInFile` in `ClientImportCounts` (cosmetic; optional follow-up)
- Changing bulk API or DB schema

## Related code (unchanged)

- `POST /api/v1/clients/bulk` — bulk submit
- `POST /api/v1/clients` — single create
- `buildClientImportPreview`, `classifyImportContact` — shared classification
- `parseVcfFile` — VCF fallback
