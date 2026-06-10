import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  DrawerNested,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import type { Client } from '@repo/salon-core/types'
import type { CompletePlaceholderClientInput } from '@repo/salon-core/forms/appointment'
import { displayPhone } from '@repo/salon-core/phone'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'

interface AppointmentDetailPlaceholderClientProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  completeForm: UseFormReturn<CompletePlaceholderClientInput>
  completeClientNameRef: RefObject<HTMLInputElement | null>
  completeClientName: string
  completeClientPhone: string
  completeErrors: UseFormReturn<CompletePlaceholderClientInput>['formState']['errors']
  duplicateClient: Client | null
  isPending: boolean
  onSubmit: () => void
  onReassignToExisting: () => void
}

export function AppointmentDetailPlaceholderClient({
  open,
  onOpenChange,
  completeForm,
  completeClientNameRef,
  completeClientName,
  completeClientPhone,
  completeErrors,
  duplicateClient,
  isPending,
  onSubmit,
  onReassignToExisting,
}: AppointmentDetailPlaceholderClientProps) {
  const { setValue: setCompleteValue, watch: watchComplete } = completeForm

  useKeyboardInset(open)

  return (
    <DrawerNested open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh] pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150">
        <DrawerHeader>
          <DrawerTitle>تکمیل اطلاعات مشتری</DrawerTitle>
          <DrawerDescription>
            نام و شماره تماس را ثبت کنید تا این نوبت از حالت موقت خارج شود.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="complete-client-name">نام مشتری</FieldLabel>
              <Input
                id="complete-client-name"
                ref={completeClientNameRef}
                value={completeClientName}
                onChange={(event) =>
                  setCompleteValue('name', event.target.value, {
                    shouldDirty: true,
                  })
                }
                placeholder="نام کامل مشتری"
              />
              {completeErrors.name ? (
                <FieldError>{completeErrors.name.message}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="complete-client-phone">
                شماره تماس
              </FieldLabel>
              <Input
                id="complete-client-phone"
                type="tel"
                value={displayPhone(completeClientPhone, '')}
                onChange={(e) => setCompleteValue('phone', e.target.value)}
                placeholder="۰۹۱۲…"
                dir="ltr"
                className="text-left tabular-nums"
              />
              {completeErrors.phone ? (
                <FieldError>{completeErrors.phone.message}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="complete-client-notes">
                یادداشت (اختیاری)
              </FieldLabel>
              <Input
                id="complete-client-notes"
                value={watchComplete('notes') ?? ''}
                onChange={(event) =>
                  setCompleteValue('notes', event.target.value, {
                    shouldDirty: true,
                  })
                }
                placeholder="یادداشت مشتری"
              />
            </Field>

            {duplicateClient ? (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm">
                <p className="font-medium text-amber-950">
                  این شماره قبلاً برای {duplicateClient.name} ثبت شده است.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  می‌توانید این نوبت را به همان مشتری موجود وصل کنید تا سابقه‌ها
                  یکی بماند.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={onReassignToExisting}
                  disabled={isPending}
                >
                  اتصال به مشتری موجود
                </Button>
              </div>
            ) : null}

            <FormRootError message={completeErrors.root?.message} />
          </FieldGroup>
        </div>

        <DrawerFooter>
          <Button
            onClick={onSubmit}
            disabled={
              isPending ||
              !completeClientName.trim() ||
              !completeClientPhone.trim()
            }
          >
            {isPending ? 'در حال ذخیره…' : 'ثبت اطلاعات'}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">بستن</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </DrawerNested>
  )
}
