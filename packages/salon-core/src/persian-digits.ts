const PERSIAN_DIGITS = [
  '۰',
  '۱',
  '۲',
  '۳',
  '۴',
  '۵',
  '۶',
  '۷',
  '۸',
  '۹',
] as const

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)])
}

export function toLatinDigits(value: string): string {
  return value
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
}

export function parseLocalizedInt(value: string, fallback = 0): number {
  const normalized = toLatinDigits(value).replace(/[^\d-]/g, '')
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function formatPersianTime(value: string): string {
  return toPersianDigits(value)
}
