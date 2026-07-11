import { timingSafeEqual } from 'node:crypto'

/** Constant-time string comparison; returns false when lengths differ. */
export function secureCompare(
  expected: string,
  provided: string | undefined | null,
): boolean {
  if (provided == null || provided.length === 0) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
