// Working-days bitmask — bit 0 = Saturday … bit 6 = Friday (ADR-0004)
export const DEFAULT_WORKING_DAYS = 126

export const WORKING_DAY_PILLS: ReadonlyArray<{ bit: number; label: string }> = [
  { bit: 0, label: 'ش' },
  { bit: 1, label: 'ی' },
  { bit: 2, label: 'د' },
  { bit: 3, label: 'س' },
  { bit: 4, label: 'چ' },
  { bit: 5, label: 'پ' },
  { bit: 6, label: 'ج' },
]

export function toggleWorkingDay(mask: number, bit: number): number {
  return mask ^ (1 << bit)
}

export function isWorkingDayOpen(mask: number, bit: number): boolean {
  return (mask & (1 << bit)) !== 0
}
