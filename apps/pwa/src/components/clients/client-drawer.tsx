import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  clientsListQueryOptions,
  useCreateClientMutation,
  useUpdateClientMutation,
} from '#/lib/clients-queries'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Badge } from '@repo/ui/badge'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { Spinner } from '@repo/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/alert-dialog'
import { toast } from '@repo/ui/use-toast'
import type { Client } from '@repo/salon-core/types'
import { displayPhone, normalizePhone } from '@repo/salon-core/phone'
import { clientFormSchema } from '@repo/salon-core/forms/client'
import type { ClientFormInput } from '@repo/salon-core/forms/client'

import {
  FormSheet,
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
} from '#/components/form-sheet'
import { DeviceContactPhoneSheet } from '#/components/clients/device-contact-phone-sheet'
import { DeviceContactPickButton } from '#/components/clients/device-contact-pick-button'
import { findClientByCanonicalPhone } from '@repo/salon-core/device-contacts'
import { isDeviceContactPickerSupported } from '#/lib/device-contacts'
import { useSingleDeviceContactPick } from '#/lib/use-single-device-contact-pick'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'

const tagOptions = [
  'VIP',
  'حساسیت',
  'رنگ خاص',
  'نیاز به پیگیری',
  'بدقول',
] as const

interface ClientDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null
  onSuccess: () => void
  onExistingClientSelected?: (client: Client) => void
}

const emptyValues: ClientFormInput = {
  name: '',
  phone: '',
  notes: '',
  tags: [],
}

function toFormValues(client: Client): ClientFormInput {
  return {
    name: client.name,
    phone: client.phone ?? '',
    notes: client.notes ?? '',
    tags: client.tags?.map((tag) => tag.label) ?? [],
  }
}

export function ClientDrawer({
  open,
  onOpenChange,
  client,
  onSuccess,
  onExistingClientSelected,
}: ClientDrawerProps) {
  const isEditing = !!client
  const { data: clients = [] } = useQuery(clientsListQueryOptions())

  const [existingClient, setExistingClient] = useState<Client | null>(null)
  const openRef = useRef(open)
  const clientsRef = useRef(clients)

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: emptyValues,
    mode: 'onSubmit',
  })

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (open) reset(client ? toFormValues(client) : emptyValues)
  }, [open, client, reset])

  useEffect(() => {
    if (!open) {
      setExistingClient(null)
    }
  }, [open])

  const nameValue = watch('name')
  const phoneValue = watch('phone')

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: isDirty && !isSubmitting,
    onClose: () => onOpenChange(false),
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      onOpenChange(true)
      return
    }
    requestClose(false)
  }

  const createClient = useCreateClientMutation()
  const updateClient = useUpdateClientMutation(client?.id ?? '')

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (client) {
        await updateClient.mutateAsync(values)
      } else {
        await createClient.mutateAsync(values)
      }
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const applyPickedContactRef = useRef<(name: string, phone: string) => void>(
    () => {},
  )

  const applyPickedContact = (name: string, phone: string) => {
    const existing = findClientByCanonicalPhone(clientsRef.current, phone)
    if (existing) {
      setExistingClient(existing)
      return
    }
    setValue('name', name, { shouldDirty: true, shouldValidate: true })
    setValue('phone', phone, { shouldDirty: true, shouldValidate: true })
    setValue('notes', '', { shouldDirty: true })
    setValue('tags', [], { shouldDirty: true })
  }

  useEffect(() => {
    applyPickedContactRef.current = applyPickedContact
  })

  const { pickFromDevice, phoneSheetProps, resetPhoneSheet } =
    useSingleDeviceContactPick({
      isActive: () => openRef.current,
      onReady: (name, phone) => applyPickedContactRef.current(name, phone),
      onChoosePhone: () => {},
    })

  useEffect(() => {
    if (!open) resetPhoneSheet()
  }, [open, resetPhoneSheet])

  const handleSelectExistingClient = () => {
    if (!existingClient) return
    if (onExistingClientSelected) {
      onExistingClientSelected(existingClient)
    } else {
      toast({ title: 'این مشتری از قبل ثبت شده است' })
    }
    setExistingClient(null)
    onOpenChange(false)
  }

  return (
    <FormSheet open={open} onOpenChange={handleOpenChange}>
      <FormSheetContent onRequestClose={() => requestClose(false)}>
        <FormSheetHeader>
          <FormSheetTitle>
            {isEditing ? 'ویرایش مشتری' : 'مشتری جدید'}
          </FormSheetTitle>
          <FormSheetDescription>
            {isEditing
              ? 'اطلاعات مشتری را به‌روز کنید'
              : 'مشتری جدید به سالن اضافه کنید'}
          </FormSheetDescription>
        </FormSheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
          onFocus={handleFormFocusScroll}
        >
          {!isEditing && isDeviceContactPickerSupported() && (
            <DeviceContactPickButton onClick={() => void pickFromDevice()} />
          )}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="client-name">نام</FieldLabel>
              <Input
                id="client-name"
                placeholder="نام مشتری"
                {...register('name')}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="client-phone">شماره تماس</FieldLabel>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    id="client-phone"
                    type="tel"
                    value={displayPhone(field.value)}
                    onChange={(e) =>
                      field.onChange(normalizePhone(e.target.value))
                    }
                    onBlur={field.onBlur}
                    placeholder="۰۹۱۲…"
                    dir="ltr"
                    className="text-left tabular-nums"
                  />
                )}
              />
              {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="client-notes">یادداشت (اختیاری)</FieldLabel>
              <Input
                id="client-notes"
                placeholder="یادداشت درباره این مشتری…"
                {...register('notes')}
              />
            </Field>

            <Field>
              <FieldLabel>برچسب‌ها</FieldLabel>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => {
                  const current = field.value ?? []
                  const toggle = (label: string) =>
                    field.onChange(
                      current.includes(label)
                        ? current.filter((t) => t !== label)
                        : [...current, label],
                    )
                  return (
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggle(label)}
                          className="touch-manipulation"
                        >
                          <Badge
                            variant={
                              current.includes(label) ? 'default' : 'outline'
                            }
                            className="px-2.5 py-1"
                          >
                            {label}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )
                }}
              />
            </Field>
          </FieldGroup>
        </form>

        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !nameValue || !phoneValue}
            className="touch-manipulation"
          >
            {isSubmitting && <Spinner className="ms-2" />}
            {isSubmitting
              ? 'در حال ذخیره…'
              : isEditing
                ? 'ذخیره تغییرات'
                : 'افزودن مشتری'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={isSubmitting}
          >
            انصراف
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
      {confirmDialog}

      <DeviceContactPhoneSheet {...phoneSheetProps} />

      <AlertDialog
        open={existingClient !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setExistingClient(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>این شماره قبلاً ثبت شده</AlertDialogTitle>
            <AlertDialogDescription>
              {existingClient
                ? `${existingClient.name} · ${displayPhone(existingClient.phone)}`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:justify-end">
            <AlertDialogCancel className="mt-0 flex-1 sm:flex-initial">
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 sm:flex-initial"
              onClick={handleSelectExistingClient}
            >
              انتخاب همین مشتری
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormSheet>
  )
}
