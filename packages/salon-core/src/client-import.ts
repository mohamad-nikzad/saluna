import { MAX_BULK_CLIENTS } from './forms/limits'
import { phoneSchema, requiredTextSchema } from './forms/primitives'
import { canonicalSalonPhone, displayPhone } from './phone'
import { toPersianDigits } from './persian-digits'
import type { VcfDraftContact } from './vcf'

export { MAX_BULK_CLIENTS }
export type { ClientBulkCreateItemPayload } from './forms/client'

export type ClientImportSkipReason =
  | 'invalid'
  | 'duplicate-existing'
  | 'duplicate-in-file'

/** Why a contact landed in the invalid bucket (only when `reason` is `invalid`). */
export type ClientImportInvalidDetail =
  | 'name'
  | 'missing-phone'
  | 'invalid-phone'

export type ClientImportPreviewSkipReason =
  | 'invalid'
  | 'duplicateExisting'
  | 'duplicateInFile'

export type ClientImportContactInput = {
  localId: string
  name: string
  phone: string | null
}

export type ClientImportClassifyContext = {
  canonicalExistingPhones: ReadonlySet<string>
  /** Batch mode: tracks phones seen so far; mutated when contact is eligible. */
  seenPhones?: Set<string>
  /** Revalidate mode: other contacts checked for in-file duplicates. */
  siblingContacts?: ReadonlyArray<ClientImportContactInput>
  /** localId excluded from sibling duplicate check (revalidate mode). */
  excludeLocalId?: string
}

export type ClientImportClassifyEligible = {
  eligible: true
  name: string
  phone: string
}

export type ClientImportClassifySkipped = {
  eligible: false
  reason: ClientImportSkipReason
  invalidDetail?: ClientImportInvalidDetail
}

export type ClientImportClassifyResult =
  | ClientImportClassifyEligible
  | ClientImportClassifySkipped

export type ClientImportCounts = {
  totalInFile: number
  eligible: number
  invalid: number
  duplicateExisting: number
  duplicateInFile: number
  truncated: boolean
}

export type ClientImportPreviewRow = {
  localId: string
  name: string
  phone: string
  selected: boolean
}

export type ClientImportSkippedRow = {
  localId: string
  name: string
  phone: string | null
  reason: ClientImportSkipReason
  invalidDetail?: ClientImportInvalidDetail
}

export type ClientImportPreview = {
  counts: ClientImportCounts
  rows: ClientImportPreviewRow[]
  skippedRows: ClientImportSkippedRow[]
}

export type RevalidateImportRowResult =
  | { valid: true }
  | { valid: false; reason: ClientImportSkipReason }

const TRUNCATED_SUFFIX = ' · فقط ۲۰۰ مورد اول نمایش داده شد'

export enum ImportCountSummary {
  EmptyEligible = 'empty-eligible',
  AllEligible = 'all-eligible',
  Mixed = 'mixed',
}

export function buildCanonicalExistingPhones(
  phones: Iterable<string>,
): Set<string> {
  return new Set([...phones].map(canonicalSalonPhone))
}

export function toPreviewSkipReason(
  reason: ClientImportSkipReason,
): ClientImportPreviewSkipReason {
  switch (reason) {
    case 'invalid':
      return 'invalid'
    case 'duplicate-existing':
      return 'duplicateExisting'
    case 'duplicate-in-file':
      return 'duplicateInFile'
  }
}

export function toApiSkipReason(
  reason: ClientImportSkipReason,
): ClientImportSkipReason {
  return reason
}

export function formatImportSkipReasonLabel(
  row: Pick<ClientImportSkippedRow, 'reason' | 'invalidDetail'>,
): string {
  if (row.reason === 'invalid') {
    switch (row.invalidDetail) {
      case 'invalid-phone':
        return 'شماره نامعتبر'
      case 'missing-phone':
        return 'بدون شماره'
      case 'name':
        return 'بدون نام'
      default:
        return 'نامعتبر'
    }
  }

  switch (row.reason) {
    case 'duplicate-existing':
      return 'تکراری (موجود)'
    case 'duplicate-in-file':
      return 'تکراری (در فایل)'
    default:
      return 'نامعتبر'
  }
}

export function classifyImportContact(
  input: ClientImportContactInput,
  context: ClientImportClassifyContext,
): ClientImportClassifyResult {
  const nameResult = requiredTextSchema.safeParse(input.name)
  if (!nameResult.success) {
    return { eligible: false, reason: 'invalid', invalidDetail: 'name' }
  }

  if (input.phone == null) {
    return {
      eligible: false,
      reason: 'invalid',
      invalidDetail: 'missing-phone',
    }
  }

  const phoneResult = phoneSchema.safeParse(input.phone)
  if (!phoneResult.success) {
    return {
      eligible: false,
      reason: 'invalid',
      invalidDetail: 'invalid-phone',
    }
  }

  const phone = phoneResult.data
  const name = nameResult.data

  if (context.canonicalExistingPhones.has(phone)) {
    return { eligible: false, reason: 'duplicate-existing' }
  }

  if (context.seenPhones != null) {
    if (context.seenPhones.has(phone)) {
      return { eligible: false, reason: 'duplicate-in-file' }
    }
    context.seenPhones.add(phone)
    return { eligible: true, name, phone }
  }

  if (context.siblingContacts != null && context.excludeLocalId != null) {
    const duplicateInFile = context.siblingContacts.some((other) => {
      if (other.localId === context.excludeLocalId) return false
      const otherPhoneResult = phoneSchema.safeParse(other.phone)
      return otherPhoneResult.success && otherPhoneResult.data === phone
    })
    if (duplicateInFile) {
      return { eligible: false, reason: 'duplicate-in-file' }
    }
  }

  return { eligible: true, name, phone }
}

export function buildClientImportPreview(
  drafts: VcfDraftContact[],
  existingPhones: ReadonlySet<string>,
): ClientImportPreview {
  const canonicalExistingPhones = buildCanonicalExistingPhones(existingPhones)
  const seenPhones = new Set<string>()
  const counts: ClientImportCounts = {
    totalInFile: drafts.length,
    eligible: 0,
    invalid: 0,
    duplicateExisting: 0,
    duplicateInFile: 0,
    truncated: false,
  }

  const eligibleRows: ClientImportPreviewRow[] = []
  const skippedRows: ClientImportSkippedRow[] = []

  for (const draft of drafts) {
    const result = classifyImportContact(draft, {
      canonicalExistingPhones,
      seenPhones,
    })

    if (result.eligible) {
      counts.eligible += 1
      eligibleRows.push({
        localId: draft.localId,
        name: result.name,
        phone: result.phone,
        selected: true,
      })
      continue
    }

    skippedRows.push({
      localId: draft.localId,
      name: draft.name,
      phone: draft.phone,
      reason: result.reason,
      invalidDetail: result.eligible ? undefined : result.invalidDetail,
    })

    switch (result.reason) {
      case 'invalid':
        counts.invalid += 1
        break
      case 'duplicate-existing':
        counts.duplicateExisting += 1
        break
      case 'duplicate-in-file':
        counts.duplicateInFile += 1
        break
    }
  }

  counts.truncated = counts.eligible > MAX_BULK_CLIENTS

  return {
    counts,
    rows: eligibleRows.slice(0, MAX_BULK_CLIENTS),
    skippedRows,
  }
}

export function revalidateImportRow(
  row: ClientImportPreviewRow,
  otherRows: ReadonlyArray<ClientImportPreviewRow>,
  existingPhones: ReadonlySet<string>,
): RevalidateImportRowResult {
  const result = classifyImportContact(row, {
    canonicalExistingPhones: buildCanonicalExistingPhones(existingPhones),
    siblingContacts: otherRows,
    excludeLocalId: row.localId,
  })

  if (result.eligible) {
    return { valid: true }
  }

  return { valid: false, reason: result.reason }
}

export function matchesImportRowSearch(
  row: ClientImportPreviewRow,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    row.name.toLowerCase().includes(q) ||
    row.phone.includes(q) ||
    displayPhone(row.phone).includes(q)
  )
}

export function matchesSkippedRowSearch(
  row: ClientImportSkippedRow,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const phone = row.phone ?? ''
  return (
    row.name.toLowerCase().includes(q) ||
    phone.includes(q) ||
    (row.phone ? displayPhone(row.phone).includes(q) : false)
  )
}

export function summarizeImportCounts(
  counts: ClientImportCounts,
): ImportCountSummary {
  const { totalInFile, eligible, invalid, duplicateExisting, duplicateInFile } =
    counts
  const duplicates = duplicateExisting + duplicateInFile

  if (eligible === 0 && totalInFile > 0) {
    return ImportCountSummary.EmptyEligible
  }

  if (eligible === totalInFile && invalid === 0 && duplicates === 0) {
    return ImportCountSummary.AllEligible
  }

  return ImportCountSummary.Mixed
}

export function formatImportCounts(counts: ClientImportCounts): string {
  const {
    totalInFile,
    eligible,
    invalid,
    duplicateExisting,
    duplicateInFile,
    truncated,
  } = counts
  const duplicates = duplicateExisting + duplicateInFile
  const summary = summarizeImportCounts(counts)

  if (summary === ImportCountSummary.EmptyEligible) {
    return 'هیچ مخاطب قابل افزودنی در فایل نیست'
  }

  if (summary === ImportCountSummary.AllEligible) {
    return `${toPersianDigits(totalInFile)} مخاطب · همه قابل افزودن${truncated ? TRUNCATED_SUFFIX : ''}`
  }

  const parts = [
    `${toPersianDigits(totalInFile)} مخاطب در فایل`,
    `${toPersianDigits(eligible)} قابل افزودن`,
  ]
  if (duplicates > 0) {
    parts.push(`${toPersianDigits(duplicates)} تکراری`)
  }
  if (invalid > 0) {
    parts.push(`${toPersianDigits(invalid)} نامعتبر`)
  }

  return parts.join(' · ') + (truncated ? TRUNCATED_SUFFIX : '')
}
