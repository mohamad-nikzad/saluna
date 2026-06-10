import type { ClientBulkCreateSkipped } from '@repo/api-client/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

export function formatBulkImportToast(
  created: number,
  skipped: ReadonlyArray<ClientBulkCreateSkipped>,
): string {
  const duplicateCount = skipped.filter(
    (item) => item.reason === 'duplicate-phone',
  ).length
  const invalidCount = skipped.filter(
    (item) => item.reason === 'invalid',
  ).length

  const skippedParts: string[] = []
  if (duplicateCount > 0) {
    skippedParts.push(
      `${toPersianDigits(duplicateCount)} تکراری نادیده گرفته شد`,
    )
  }
  if (invalidCount > 0) {
    skippedParts.push(
      `${toPersianDigits(invalidCount)} نامعتبر نادیده گرفته شد`,
    )
  }

  if (created === 0) {
    return skippedParts.join(' · ')
  }

  if (skipped.length === 0) {
    return `${toPersianDigits(created)} مشتری اضافه شد`
  }

  return `${toPersianDigits(created)} اضافه شد · ${skippedParts.join(' · ')}`
}
