/**
 * Curated public-page layout presets. The manager picks how the public salon
 * page presents services and booking. Layout id is stored as `layout_id` on
 * `salon_public_settings`.
 *
 * - `agenda` — service icon grid + a vertical day-by-day agenda booking sheet.
 * - `inline` — services grouped by category, tap to expand inline booking.
 */

export type PublicLayoutId = 'agenda' | 'inline'

export type PublicLayout = {
  id: PublicLayoutId
  name: string
  description: string
}

export const PUBLIC_LAYOUTS: readonly PublicLayout[] = [
  {
    id: 'agenda',
    name: 'تقویم روزانه',
    description: 'خدمات به‌صورت کارت‌های آیکونی؛ رزرو با تقویم روزبه‌روز.',
  },
  {
    id: 'inline',
    name: 'فهرست خدمات',
    description:
      'خدمات دسته‌بندی‌شده؛ با لمس هر خدمت، رزرو همان‌جا باز می‌شود.',
  },
] as const

export const DEFAULT_PUBLIC_LAYOUT_ID: PublicLayoutId = 'agenda'

export function resolvePublicLayout(
  id: string | null | undefined,
): PublicLayout {
  const found = PUBLIC_LAYOUTS.find((l) => l.id === id)
  return found ?? PUBLIC_LAYOUTS[0]!
}

export function isPublicLayoutId(value: unknown): value is PublicLayoutId {
  return typeof value === 'string' && PUBLIC_LAYOUTS.some((l) => l.id === value)
}
