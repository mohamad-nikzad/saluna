import { useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Leaf,
  Paintbrush,
  Scissors,
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import { useIsTouch } from '@repo/ui/use-mobile'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/command'
import { cn } from '@repo/ui/utils'
import type { Service } from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { ResponsivePicker } from '#/components/responsive-picker'
import {
  formatCompactServiceLabel,
  groupServicesByCatalog,
} from './service-catalog-groups'

interface ServicePickerProps {
  services: Service[]
  value?: string
  onChange: (serviceId: string) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  showPrice?: boolean
  getDisabledReason?: (service: Service) => string | null | undefined
  getStatusReason?: (service: Service) => string | null | undefined
}

function formatTomans(price: number) {
  if (price <= 0) return 'قیمت وارد نشده'
  return `${new Intl.NumberFormat('fa-IR').format(price)} تومان`
}

function serviceIconFor(category: Service['category']) {
  switch (category) {
    case 'hair':
      return Scissors
    case 'nails':
      return Paintbrush
    case 'skincare':
      return Leaf
    case 'spa':
      return Sparkles
  }
}

export function ServicePicker({
  services,
  value,
  onChange,
  onClear,
  placeholder = 'انتخاب خدمت',
  disabled,
  showPrice = true,
  getDisabledReason,
  getStatusReason,
}: ServicePickerProps) {
  const [open, setOpen] = useState(false)
  const isTouch = useIsTouch()
  const selectedService = useMemo(
    () => services.find((service) => service.id === value),
    [services, value],
  )
  const groups = useMemo(() => groupServicesByCatalog(services), [services])

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      dir="rtl"
      className="h-9 touch:h-11 w-full justify-between gap-3 whitespace-normal bg-blush-soft px-3 py-1 text-start hover:bg-blush-soft"
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-start',
          !selectedService && 'text-muted-foreground',
        )}
      >
        {selectedService
          ? formatCompactServiceLabel(selectedService)
          : placeholder}
      </span>
      {isTouch ? (
        <ChevronLeft className="size-4 shrink-0 opacity-50" />
      ) : (
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      )}
    </Button>
  )

  return (
    <div className="flex w-full min-w-0 gap-2">
      <div className="min-w-0 flex-1">
        <ResponsivePicker
          open={open}
          onOpenChange={setOpen}
          trigger={trigger}
          title={placeholder}
          popoverContentClassName="w-[min(28rem,calc(100vw-2rem))]"
        >
          <Command
            filter={(itemValue, search) => {
              if (!search.trim()) return 1
              return itemValue
                .toLocaleLowerCase('fa')
                .includes(search.toLocaleLowerCase('fa'))
                ? 1
                : 0
            }}
          >
            <CommandInput placeholder="جستجوی بخش، گروه یا خدمت..." />
            <CommandList className="max-h-[min(70dvh,24rem,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto">
              <CommandEmpty>خدمتی پیدا نشد.</CommandEmpty>
              {groups.map((category) => (
                <CommandGroup
                  key={category.categoryId}
                  heading={category.categoryName}
                  className="pb-1 pt-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2"
                >
                  {category.families.map((family) => (
                    <div key={family.familyId} className="mb-1">
                      <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-1 text-[11px] font-medium text-muted-foreground">
                        {(() => {
                          const Icon = serviceIconFor(
                            family.services[0]?.category ?? 'spa',
                          )
                          return (
                            <Icon
                              aria-hidden="true"
                              className="size-3.5 shrink-0 opacity-70"
                            />
                          )
                        })()}
                        <span className="min-w-0 truncate">
                          {family.familyName}
                        </span>
                      </div>
                      <div className="relative mr-2 space-y-0.5 pr-2 before:absolute before:right-0 before:bottom-1 before:top-1 before:w-px before:bg-muted-foreground/35">
                        {family.services.map((service) => {
                          const disabledReason = getDisabledReason?.(service)
                          const statusReason = getStatusReason?.(service)
                          return (
                            <CommandItem
                              key={service.id}
                              value={`${category.categoryName} ${family.familyName} ${service.name} ${service.id}`}
                              disabled={Boolean(disabledReason)}
                              onSelect={() => {
                                if (disabledReason) return
                                onChange(service.id)
                                setOpen(false)
                              }}
                              className="relative rounded-md py-1.5 pl-8 pr-1.5 before:absolute before:right-[-0.5rem] before:top-1/2 before:h-px before:w-1.5 before:bg-muted-foreground/35"
                            >
                              <Check
                                className={cn(
                                  'absolute left-2 top-2 size-4 shrink-0',
                                  value === service.id
                                    ? 'opacity-100'
                                    : 'opacity-0',
                                )}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {service.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {toPersianDigits(service.duration)} دقیقه
                                  {showPrice
                                    ? ` · ${formatTomans(service.price)}`
                                    : ''}
                                </span>
                              </span>
                              {disabledReason || statusReason ? (
                                <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                  {disabledReason ?? statusReason}
                                </span>
                              ) : null}
                            </CommandItem>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </ResponsivePicker>
      </div>
      {selectedService && onClear ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label="پاک کردن خدمت"
          className="h-9 w-9 touch:h-11 touch:w-11 shrink-0 bg-blush-soft hover:bg-secondary/60"
          onClick={onClear}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
