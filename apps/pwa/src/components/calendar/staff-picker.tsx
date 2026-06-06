import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, X } from 'lucide-react'
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
import type { User } from '@repo/salon-core/types'
import { ResponsivePicker } from '#/components/responsive-picker'
import { personInitials } from '#/lib/roster-visuals'

export type StaffPickerStatus = {
  disabled?: boolean
  /** Short Persian label shown as a chip (e.g. "خارج از برنامه"). */
  reason?: string | null
}

interface StaffPickerProps {
  staff: User[]
  value?: string
  onChange: (staffId: string) => void
  onClear?: () => void
  placeholder?: string
  disabled?: boolean
  getStatus?: (member: User) => StaffPickerStatus | undefined
}

function StaffAvatar({
  name,
  selected,
  size = 28,
}: {
  name: string
  selected?: boolean
  size?: number
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-plum-deep',
      )}
      style={{ width: size, height: size }}
    >
      {personInitials(name)}
    </span>
  )
}

export function StaffPicker({
  staff,
  value,
  onChange,
  onClear,
  placeholder = 'انتخاب پرسنل',
  disabled,
  getStatus,
}: StaffPickerProps) {
  const [open, setOpen] = useState(false)
  const isTouch = useIsTouch()
  const selected = useMemo(
    () => staff.find((member) => member.id === value),
    [staff, value],
  )

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
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {selected ? (
          <>
            <StaffAvatar name={selected.name} />
            <span className="min-w-0 flex-1 truncate text-start">
              {selected.name}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-start text-muted-foreground">
            {placeholder}
          </span>
        )}
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
          popoverContentClassName="w-[min(24rem,calc(100vw-2rem))]"
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
            <CommandInput placeholder="جستجوی پرسنل..." />
            <CommandList className="max-h-[min(22rem,var(--radix-popover-content-available-height))] overscroll-contain overflow-y-auto">
              <CommandEmpty>پرسنلی پیدا نشد.</CommandEmpty>
              <CommandGroup className="py-1">
                {staff.map((member) => {
                  const status = getStatus?.(member)
                  const isDisabled = Boolean(status?.disabled)
                  const isSelected = value === member.id
                  return (
                    <CommandItem
                      key={member.id}
                      value={`${member.name} ${member.id}`}
                      disabled={isDisabled}
                      onSelect={() => {
                        if (isDisabled) return
                        onChange(member.id)
                        setOpen(false)
                      }}
                      className="relative rounded-md px-2 py-2"
                    >
                      <Check
                        className={cn(
                          'mr-1 size-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <StaffAvatar name={member.name} selected={isSelected} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {member.name}
                      </span>
                      {status?.reason ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {status.reason}
                        </span>
                      ) : null}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </ResponsivePicker>
      </div>
      {selected && onClear ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label="پاک کردن پرسنل"
          className="h-9 w-9 touch:h-11 touch:w-11 shrink-0 bg-blush-soft hover:bg-secondary/60"
          onClick={onClear}
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
