import { displayPhone } from '@repo/salon-core/phone'
import { Button } from '@repo/ui/button'
import {
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
} from '@repo/ui/drawer'
import {
  FormSheet,
  FormSheetContent,
  FormSheetDescription,
  FormSheetHeader,
  FormSheetTitle,
} from '#/components/form-sheet'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'

interface DeviceContactPhoneSheetProps {
  open: boolean
  name: string
  phones: string[]
  onSelect: (phone: string) => void
  onOpenChange: (open: boolean) => void
  /** Use inside an existing drawer (ClientPicker, ClientDrawer). Default true. */
  nested?: boolean
}

function PhoneOptions({
  phones,
  onSelect,
  onOpenChange,
}: Pick<DeviceContactPhoneSheetProps, 'phones' | 'onSelect' | 'onOpenChange'>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-4">
      {phones.map((phone) => (
        <Button
          key={phone}
          type="button"
          variant="outline"
          className="touch-manipulation justify-start text-left tabular-nums"
          dir="ltr"
          onClick={() => {
            onSelect(phone)
            onOpenChange(false)
          }}
        >
          {displayPhone(phone)}
        </Button>
      ))}
    </div>
  )
}

export function DeviceContactPhoneSheet({
  open,
  name,
  phones,
  onSelect,
  onOpenChange,
  nested = true,
}: DeviceContactPhoneSheetProps) {
  useKeyboardInset(open)

  if (nested) {
    return (
      <DrawerNested
        open={open}
        onOpenChange={onOpenChange}
        repositionInputs={false}
      >
        <DrawerContent
          showClose={false}
          className="max-h-[88lvh] pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150"
        >
          <DrawerHeader className="pe-5">
            <DrawerTitle>کدام شماره؟</DrawerTitle>
            {name ? <DrawerDescription>{name}</DrawerDescription> : null}
          </DrawerHeader>
          <PhoneOptions
            phones={phones}
            onSelect={onSelect}
            onOpenChange={onOpenChange}
          />
        </DrawerContent>
      </DrawerNested>
    )
  }

  return (
    <FormSheet open={open} onOpenChange={onOpenChange}>
      <FormSheetContent onRequestClose={() => onOpenChange(false)}>
        <FormSheetHeader>
          <FormSheetTitle>کدام شماره؟</FormSheetTitle>
          {name ? <FormSheetDescription>{name}</FormSheetDescription> : null}
        </FormSheetHeader>
        <PhoneOptions
          phones={phones}
          onSelect={onSelect}
          onOpenChange={onOpenChange}
        />
      </FormSheetContent>
    </FormSheet>
  )
}
