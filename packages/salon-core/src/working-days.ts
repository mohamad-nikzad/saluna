// Working-days bitmask — bit 0 = Saturday … bit 6 = Friday (ADR-0004)
export const DEFAULT_WORKING_DAYS = 126

export const WORKING_DAY_PILLS = [
  { bit: 0, label: 'ش', fullLabel: 'شنبه', schema: 'Saturday' },
  { bit: 1, label: 'ی', fullLabel: 'یکشنبه', schema: 'Sunday' },
  { bit: 2, label: 'د', fullLabel: 'دوشنبه', schema: 'Monday' },
  { bit: 3, label: 'س', fullLabel: 'سه‌شنبه', schema: 'Tuesday' },
  { bit: 4, label: 'چ', fullLabel: 'چهارشنبه', schema: 'Wednesday' },
  { bit: 5, label: 'پ', fullLabel: 'پنجشنبه', schema: 'Thursday' },
  { bit: 6, label: 'ج', fullLabel: 'جمعه', schema: 'Friday' },
] as const

export function toggleWorkingDay(mask: number, bit: number): number {
  return mask ^ (1 << bit)
}

export function isWorkingDayOpen(mask: number, bit: number): boolean {
  return (mask & (1 << bit)) !== 0
}
