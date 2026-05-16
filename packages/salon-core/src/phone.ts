/** Normalize phone for storage and unique lookup (digits only, Persian/Arabic → Latin). */
import { toLatinDigits, toPersianDigits } from "./persian-digits";

export function normalizePhone(input: string): string {
  const s = toLatinDigits(input.trim());
  return s.replace(/\D/g, "");
}

export function hasPhone(
  normalized: string | null | undefined,
): normalized is string {
  return typeof normalized === "string" && normalized.length > 0;
}

export function displayPhone(
  normalized: string | null | undefined,
  fallback = "",
): string {
  return hasPhone(normalized) ? toPersianDigits(normalized) : fallback;
}
