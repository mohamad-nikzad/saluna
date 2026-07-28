'use client'

import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import {
  changeSalonLocation,
  getIranCities,
  IRAN_PROVINCES,
  persianSearchFilter,
  type SalonLocation,
} from '@repo/salon-core/iran-locations'

import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import { Field, FieldError, FieldLabel } from './field'
import { Input } from './input'
import { ResponsivePicker } from './responsive-picker'
import { cn } from './utils'

type LocationField = keyof SalonLocation

export type SalonLocationFieldsProps = {
  value: SalonLocation
  onChange: (value: SalonLocation) => void
  errors?: Partial<Record<LocationField, string>>
  ids?: Partial<Record<LocationField, string>>
}

function ChoicePicker({
  id,
  label,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  value,
  options,
  disabled,
  error,
  onChange,
}: {
  id: string
  label: string
  placeholder: string
  searchPlaceholder: string
  emptyMessage: string
  value: string
  options: string[]
  disabled?: boolean
  error?: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-invalid={Boolean(error) || undefined}
      disabled={disabled}
      className="h-9 touch:h-11 w-full min-w-0 justify-between px-3 font-normal"
    >
      <span
        className={cn('truncate text-start', !value && 'text-muted-foreground')}
      >
        {value || placeholder}
      </span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
    </Button>
  )

  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <div className="min-w-0 flex-1">
          <ResponsivePicker
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            title={label}
            popoverContentClassName="w-[min(24rem,calc(100vw-2rem))]"
          >
            <Command filter={persianSearchFilter}>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        onChange(option)
                        setOpen(false)
                      }}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn(
                          'size-4',
                          option === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {option}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </ResponsivePicker>
        </div>
        {value ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`پاک کردن ${label}`}
            className="size-9 touch:size-11 shrink-0"
            onClick={() => onChange('')}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

function NeighborhoodField({
  id,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>محله (اختیاری)</FieldLabel>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={120}
        placeholder={disabled ? 'ابتدا شهر را انتخاب کنید' : 'نام محله'}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

export function SalonLocationFields({
  value,
  onChange,
  errors = {},
  ids = {},
}: SalonLocationFieldsProps) {
  const generatedId = React.useId()
  const fieldId = (field: LocationField) =>
    ids[field] ?? `${generatedId}-${field}`

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoicePicker
        id={fieldId('province')}
        label="استان"
        placeholder="انتخاب استان"
        searchPlaceholder="جستجوی استان…"
        emptyMessage="استانی پیدا نشد."
        value={value.province}
        options={IRAN_PROVINCES}
        error={errors.province}
        onChange={(province) =>
          onChange(changeSalonLocation(value, 'province', province))
        }
      />
      <ChoicePicker
        id={fieldId('city')}
        label="شهر"
        placeholder={
          value.province ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'
        }
        searchPlaceholder="جستجوی شهر…"
        emptyMessage="شهری پیدا نشد."
        value={value.city}
        options={getIranCities(value.province)}
        error={errors.city}
        disabled={!value.province}
        onChange={(city) => onChange(changeSalonLocation(value, 'city', city))}
      />
      <div className="sm:col-span-2">
        <NeighborhoodField
          id={fieldId('neighborhood')}
          value={value.neighborhood}
          error={errors.neighborhood}
          disabled={!value.city}
          onChange={(neighborhood) =>
            onChange(changeSalonLocation(value, 'neighborhood', neighborhood))
          }
        />
      </div>
    </div>
  )
}
