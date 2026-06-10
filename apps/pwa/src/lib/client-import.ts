import { clientBulkCreateItemSchema } from '@repo/salon-core/forms/client'
import {
  ImportCountSummary,
  summarizeImportCounts,
  type ClientImportCounts,
  type ClientImportPreviewRow,
} from '@repo/salon-core'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

const TRUNCATED_SUFFIX = ' · فقط ۲۰۰ مورد اول نمایش داده شد'

const COUNT_MESSAGES: Record<
  ImportCountSummary,
  (counts: ClientImportCounts) => string
> = {
  [ImportCountSummary.EmptyEligible]: () => 'هیچ مخاطب قابل افزودنی نیست',
  [ImportCountSummary.AllEligible]: (counts) =>
    `${toPersianDigits(counts.totalInFile)} مخاطب · همه قابل افزودن${counts.truncated ? TRUNCATED_SUFFIX : ''}`,
  [ImportCountSummary.Mixed]: (counts) => {
    const duplicates = counts.duplicateExisting + counts.duplicateInFile
    const parts = [
      `${toPersianDigits(counts.totalInFile)} مخاطب`,
      `${toPersianDigits(counts.eligible)} قابل افزودن`,
    ]
    if (duplicates > 0) {
      parts.push(`${toPersianDigits(duplicates)} تکراری`)
    }
    if (counts.invalid > 0) {
      parts.push(`${toPersianDigits(counts.invalid)} نامعتبر`)
    }
    return parts.join(' · ') + (counts.truncated ? TRUNCATED_SUFFIX : '')
  },
}

export function formatImportCounts(counts: ClientImportCounts): string {
  return COUNT_MESSAGES[summarizeImportCounts(counts)](counts)
}

export function validateBulkImportItems(
  rows: ReadonlyArray<ClientImportPreviewRow>,
): Array<{ name: string; phone: string }> {
  return rows
    .map((row) => clientBulkCreateItemSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data)
}

export function getBulkImportSubmitClients(
  rows: ReadonlyArray<ClientImportPreviewRow>,
): Array<{ name: string; phone: string }> {
  return validateBulkImportItems(rows.filter((row) => row.selected))
}

export type ImportPreviewFilter =
  | 'eligible'
  | 'invalid'
  | 'duplicate'
  | 'all-skipped'

export function defaultImportPreviewFilter(
  counts: ClientImportCounts,
): ImportPreviewFilter {
  if (counts.eligible > 0) return 'eligible'
  if (counts.invalid > 0) return 'invalid'
  if (counts.duplicateExisting + counts.duplicateInFile > 0) {
    return 'duplicate'
  }
  return 'all-skipped'
}
