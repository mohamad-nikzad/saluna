/** Skip reasons returned by bulk client create (API contract). */
export type BulkCreateClientSkipReason = 'duplicate-phone' | 'invalid'

export type BulkCreateClientSkipped = {
  phone: string
  reason: BulkCreateClientSkipReason
}

/** Detects unique-constraint / duplicate-key failures from DB or auth layers. */
export function isDuplicatePhoneError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  return (
    msg.includes('unique') ||
    msg.includes('duplicate') ||
    msg.includes('already') ||
    msg.includes('exists')
  )
}
