import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import {
  changeSalonLocation,
  getIranCities,
  IRAN_PROVINCES,
  persianSearchFilter,
  type SalonLocation,
} from '@repo/salon-core/iran-locations'

import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { cn } from '#/lib/utils'

function useCoarsePointer() {
  const [coarse, setCoarse] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return coarse
}

function ResponsivePicker({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}) {
  const coarse = useCoarsePointer()

  if (coarse) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="flex max-h-[88dvh] flex-col gap-0 rounded-t-2xl p-0"
        >
          <SheetHeader className="shrink-0 border-b px-5 py-4 text-start">
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&_[data-slot=command-list]]:!max-h-none [&_[data-slot=command-list]]:flex-1">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(70dvh,24rem)] w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
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
      disabled={disabled}
      className="h-9 touch:h-11 w-full min-w-0 justify-between px-3 font-normal"
    >
      <span
        className={cn(
          'truncate text-start',
          !value && 'text-muted-foreground',
        )}
      >
        {value || placeholder}
      </span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
    </Button>
  )

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex min-w-0 gap-2">
        <div className="min-w-0 flex-1">
          <ResponsivePicker
            open={open}
            onOpenChange={setOpen}
            trigger={trigger}
            title={label}
          >
            <Command filter={persianSearchFilter}>
              <CommandInput
                className="touch:text-base"
                placeholder={searchPlaceholder}
              />
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      className="touch:min-h-11 touch:text-base"
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
            className="h-9 w-9 touch:h-11 touch:w-11 shrink-0"
            onClick={() => onChange('')}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>
    </Field>
  )
}

function NeighborhoodField({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>محله (اختیاری)</FieldLabel>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={120}
        placeholder={disabled ? 'ابتدا شهر را انتخاب کنید' : 'نام محله'}
        className="touch:text-base"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export function SalonLocationFields({
  value,
  onChange,
}: {
  value: SalonLocation
  onChange: (value: SalonLocation) => void
}) {
  const id = React.useId()

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoicePicker
        id={`${id}-province`}
        label="استان"
        placeholder="انتخاب استان"
        searchPlaceholder="جستجوی استان…"
        emptyMessage="استانی پیدا نشد."
        value={value.province}
        options={IRAN_PROVINCES}
        onChange={(province) =>
          onChange(changeSalonLocation(value, 'province', province))
        }
      />
      <ChoicePicker
        id={`${id}-city`}
        label="شهر"
        placeholder={value.province ? 'انتخاب شهر' : 'ابتدا استان را انتخاب کنید'}
        searchPlaceholder="جستجوی شهر…"
        emptyMessage="شهری پیدا نشد."
        value={value.city}
        options={getIranCities(value.province)}
        disabled={!value.province}
        onChange={(city) =>
          onChange(changeSalonLocation(value, 'city', city))
        }
      />
      <div className="sm:col-span-2">
        <NeighborhoodField
          id={`${id}-neighborhood`}
          value={value.neighborhood}
          disabled={!value.city}
          onChange={(neighborhood) =>
            onChange(changeSalonLocation(value, 'neighborhood', neighborhood))
          }
        />
      </div>
    </div>
  )
}
