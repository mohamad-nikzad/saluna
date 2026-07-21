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
import { formatCompactServiceLabel } from '#/components/services/service-catalog-groups'

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
  ariaLabel?: string
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

function groupServicesByCategory(services: Service[]) {
  const groups = new Map<
    string,
    {
      categoryId: string
      categoryName: string
      services: Service[]
    }
  >()

  for (const service of services) {
    const categoryId = service.categoryId || service.category
    const categoryName = service.categoryName ?? service.category
    const group = groups.get(categoryId) ?? {
      categoryId,
      categoryName,
      services: [],
    }
    group.services.push(service)
    groups.set(categoryId, group)
  }

  return [...groups.values()]
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
  ariaLabel,
}: ServicePickerProps) {
  const [open, setOpen] = useState(false)
  const isTouch = useIsTouch()
  const selectedService = useMemo(
    () => services.find((service) => service.id === value),
    [services, value],
  )
  const groups = useMemo(() => groupServicesByCategory(services), [services])

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-label={ariaLabel}
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
            <CommandInput placeholder="جستجوی بخش یا خدمت..." />
            <CommandList className="max-h-[min(70dvh,24rem,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto">
              <CommandEmpty>خدمتی پیدا نشد.</CommandEmpty>
              {groups.map((category) => (
                <CommandGroup
                  key={category.categoryId}
                  heading={category.categoryName}
                  className="pb-1 pt-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2"
                >
                  {category.services.map((service) => {
                    const disabledReason = getDisabledReason?.(service)
                    const statusReason = getStatusReason?.(service)
                    const Icon = serviceIconFor(service.category)
                    return (
                      <CommandItem
                        key={service.id}
                        value={`${category.categoryName} ${service.name} ${service.id}`}
                        disabled={Boolean(disabledReason)}
                        onSelect={() => {
                          if (disabledReason) return
                          onChange(service.id)
                          setOpen(false)
                        }}
                        className="rounded-md py-1.5 pl-8 pr-1.5"
                      >
                        <Check
                          className={cn(
                            'absolute left-2 top-2 size-4 shrink-0',
                            value === service.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <Icon
                          aria-hidden="true"
                          className="size-3.5 shrink-0 text-muted-foreground"
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
