import { useLayoutEffect, useRef, type ComponentProps } from 'react'

import { Input } from '@repo/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@repo/ui/input-group'
import { toLatinDigits, toPersianDigits } from '@repo/salon-core/persian-digits'

type LocalizedNumberInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  value: string | number | null | undefined
  onValueChange: (value: string) => void
  inputMode?: 'numeric' | 'decimal'
  suffix?: string
  currency?: boolean
}

const DIGIT_RE = /[0-9\u06F0-\u06F9\u0660-\u0669]/
const groupedInteger = new Intl.NumberFormat('fa-IR', {
  maximumFractionDigits: 0,
})

export function countLocalizedDigits(value: string): number {
  let count = 0
  for (const ch of value) {
    if (DIGIT_RE.test(ch)) count += 1
  }
  return count
}

export function caretFromDigitCount(
  formatted: string,
  digitCount: number,
): number {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (!DIGIT_RE.test(formatted[i] ?? '')) continue
    seen += 1
    if (seen === digitCount) return i + 1
  }
  return formatted.length
}

export function formatLocalizedNumberInput(
  value: string | number | null | undefined,
): string {
  if (value == null) return ''
  const raw = String(value)
  if (raw === '') return ''
  const latin = toLatinDigits(raw)
  const negative = latin.startsWith('-')
  const unsigned = negative ? latin.slice(1) : latin
  const hasDecimal = unsigned.includes('.')
  const [whole = '', fraction] = unsigned.split('.')
  const formattedWhole =
    whole === '' ? '' : groupedInteger.format(Number.parseInt(whole, 10) || 0)
  const sign = negative ? '−' : ''
  if (!hasDecimal) return `${sign}${formattedWhole}`
  return `${sign}${formattedWhole || toPersianDigits('0')}٫${toPersianDigits(fraction ?? '')}`
}

export function normalizeLocalizedIntegerInput(value: string): string {
  return toLatinDigits(value).replace(/[^\d]/g, '')
}

export function normalizeLocalizedDecimalInput(value: string): string {
  const [whole = '', ...fraction] = toLatinDigits(value)
    .replace(/[٬،]/g, '')
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
  suffix,
  currency = false,
  className,
  disabled,
  ...props
}: LocalizedNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaretDigits = useRef<number | null>(null)
  const formatted = formatLocalizedNumberInput(value)

  useLayoutEffect(() => {
    const input = inputRef.current
    const digitCount = pendingCaretDigits.current
    if (!input || digitCount == null) return
    pendingCaretDigits.current = null
    const pos = caretFromDigitCount(formatted, digitCount)
    input.setSelectionRange(pos, pos)
  }, [formatted])

  const handleChange = (raw: string, caret: number) => {
    pendingCaretDigits.current = countLocalizedDigits(raw.slice(0, caret))
    onValueChange(
      inputMode === 'decimal'
        ? normalizeLocalizedDecimalInput(raw)
        : normalizeLocalizedIntegerInput(raw),
    )
  }

  const inputClassName = className ?? 'text-right tabular-nums'
  const control = (
    <InputGroupInput
      {...props}
      ref={inputRef}
      disabled={disabled}
      type="text"
      inputMode={inputMode}
      value={formatted}
      onChange={(event) =>
        handleChange(
          event.target.value,
          event.target.selectionStart ?? event.target.value.length,
        )
      }
      dir="rtl"
      className={inputClassName}
    />
  )

  if (currency) {
    return (
      <InputGroup
        className="bg-blush-soft"
        data-disabled={disabled ? true : undefined}
      >
        {control}
        <InputGroupAddon align="inline-end">
          <InputGroupText>تومان</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    )
  }

  if (suffix) {
    return (
      <InputGroup
        className="bg-blush-soft"
        data-disabled={disabled ? true : undefined}
      >
        {control}
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    )
  }

  return (
    <Input
      {...props}
      ref={inputRef}
      disabled={disabled}
      type="text"
      inputMode={inputMode}
      value={formatted}
      onChange={(event) =>
        handleChange(
          event.target.value,
          event.target.selectionStart ?? event.target.value.length,
        )
      }
      dir="rtl"
      className={inputClassName}
    />
  )
}
