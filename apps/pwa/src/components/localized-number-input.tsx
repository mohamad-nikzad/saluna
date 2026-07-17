import type { ComponentProps } from 'react'

import { Input } from '@repo/ui/input'
import { toLatinDigits, toPersianDigits } from '@repo/salon-core/persian-digits'

type LocalizedNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  value: string | number | null | undefined
  onValueChange: (value: string) => void
  inputMode?: 'numeric' | 'decimal'
}

export function formatLocalizedNumberInput(
  value: string | number | null | undefined,
): string {
  if (value == null) return ''
  return toPersianDigits(value)
}

export function normalizeLocalizedIntegerInput(value: string): string {
  return toLatinDigits(value).replace(/[^\d]/g, '')
}

export function normalizeLocalizedDecimalInput(value: string): string {
  const [whole = '', ...fraction] = toLatinDigits(value)
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.]/g, '')
    .split('.')
  return fraction.length > 0 ? `${whole}.${fraction.join('')}` : whole
}

export function parseOptionalLocalizedInteger(
  value: string | number | null | undefined,
): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const normalized = normalizeLocalizedIntegerInput(value)
  if (normalized === '') return null
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function LocalizedNumberInput({
  value,
  onValueChange,
  inputMode = 'numeric',
  className,
  ...props
}: LocalizedNumberInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={inputMode}
      value={formatLocalizedNumberInput(value)}
      onChange={(event) =>
        onValueChange(
          inputMode === 'decimal'
            ? normalizeLocalizedDecimalInput(event.target.value)
            : normalizeLocalizedIntegerInput(event.target.value),
        )
      }
      dir="rtl"
      className={className ?? 'text-right tabular-nums'}
    />
  )
}
