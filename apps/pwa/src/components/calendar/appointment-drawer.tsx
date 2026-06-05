import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  FormSheet,
  FormSheetContent,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetDescription,
  FormSheetFooter,
} from '#/components/form-sheet'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Checkbox } from '@repo/ui/checkbox'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Spinner } from '@repo/ui/spinner'
import { Textarea } from '@repo/ui/textarea'
import { cn } from '@repo/ui/utils'
import { ChevronDown, Check } from 'lucide-react'
import { StaffPicker } from '#/components/calendar/staff-picker'
import type {
  User,
  Service,
  ServiceAddon,
  Client,
  AppointmentWithDetails,
} from '@repo/salon-core/types'
import {
  endTimeFromDuration,
  formatTimeHm,
  parseTimeHm,
} from '@repo/salon-core/appointment-time'
import { ClientPicker } from '#/components/calendar/client-picker'
import {
  appointmentCreateFormDefaults,
  buildAppointmentCreateViewModel,
  clampAppointmentDuration,
  durationFromEndTime,
  resolveIntakeAddonToggle,
  resolveIntakeServiceChange,
  resolveIntakeStaffChange,
  validateAppointmentIntakeSubmit,
} from '#/lib/appointment-intake'
import {
  tomansFormatter,
  useStaffBookingAvailability,
} from '#/lib/appointment-surface'
import { useServiceAddons } from '#/lib/use-service-addons'
import { useAppointmentIntakeMutations } from '#/lib/use-appointment-intake-mutations'
import { ServicePicker } from '#/components/services/service-picker'
import { useNetworkStatus } from '#/lib/network-status'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { appointmentFormSchema } from '@repo/salon-core/forms/appointment'
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'
import {
  LocalizedNumberInput,
  parseOptionalLocalizedInteger,
} from '#/components/localized-number-input'

const DURATION_PRESETS = [30, 45, 60, 90, 120]

interface AppointmentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string
  initialTime: string
  initialStaffId?: string
  initialServiceId?: string
  initialClientId?: string
  staff: User[]
  services: Service[]
  clients: Client[]
  onSuccess: (appointment: AppointmentWithDetails) => void
  onClientsChanged?: () => void
}

export function AppointmentDrawer({
  open,
  onOpenChange,
  initialDate,
  initialTime,
  initialStaffId,
  initialServiceId,
  initialClientId,
  staff,
  services,
  clients,
  onSuccess,
  onClientsChanged,
}: AppointmentDrawerProps) {
  const isOnline = useNetworkStatus()
  const [localClients, setLocalClients] = useState<Client[]>(clients)
  const form = useForm<AppointmentFormInput>({
    resolver: zodResolver(appointmentFormSchema, undefined, { raw: true }),
    defaultValues: {
      useTemporaryClient: false,
      clientId: '',
      staffId: initialStaffId ?? '',
      serviceId: initialServiceId ?? '',
      date: initialDate,
      startTime: formatTimeHm(parseTimeHm(initialTime)),
      endTime: endTimeFromDuration(formatTimeHm(parseTimeHm(initialTime)), 45),
      durationMinutes: 45,
      notes: '',
      temporaryClientName: '',
      temporaryClientNotes: '',
      addonIds: [],
    },
  })
  const {
    control,
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form

  const clientId = watch('clientId')
  const staffId = watch('staffId')
  const serviceId = watch('serviceId')
  const date = watch('date')
  const startTime = watch('startTime')
  const durationInput = watch('durationMinutes')
  const durationMinutes = parseOptionalLocalizedInteger(durationInput) ?? 45
  const endTime =
    watch('endTime') || endTimeFromDuration(startTime, durationMinutes)
  const useTemporaryClient = Boolean(watch('useTemporaryClient'))
  const temporaryClientName = watch('temporaryClientName')
  const addonIds = watch('addonIds') ?? []
  const staffSlotOk = useStaffBookingAvailability(
    open,
    date,
    startTime,
    endTime,
    isOnline,
  )
  const { data: availableAddons = [], isPending: addonsLoading } =
    useServiceAddons(serviceId ?? '', open && !!serviceId)
  const createViewModel = useMemo(
    () =>
      buildAppointmentCreateViewModel({
        staff,
        services,
        staffId: staffId ?? '',
        serviceId: serviceId ?? '',
        addonIds,
        availableAddons,
        durationMinutes,
        staffSlotOk,
      }),
    [
      staff,
      services,
      staffId,
      serviceId,
      addonIds,
      availableAddons,
      durationMinutes,
      staffSlotOk,
    ],
  )
  const {
    staffRoleOnly,
    activeServices,
    selectedService,
    previewDuration,
    previewPrice,
    serviceIdsWithStaff,
    serviceDisabledReason,
    staffPickerStatus,
    selectedServiceHasStaff,
    selectedStaffHasServices,
    selectedStaffCanPerformSelectedService,
  } = createViewModel

  useEffect(() => {
    setLocalClients(clients)
  }, [clients])

  const resetFormForInitialSlot = useCallback(() => {
    reset(
      appointmentCreateFormDefaults({
        initialDate,
        initialTime,
        initialStaffId,
        initialServiceId,
        initialClientId,
        services,
      }),
    )
    setLocalClients(clients)
  }, [
    clients,
    initialClientId,
    initialDate,
    initialServiceId,
    initialStaffId,
    initialTime,
    reset,
    services,
  ])

  const applyDuration = (mins: number) => {
    const clamped = clampAppointmentDuration(mins)
    setValue('durationMinutes', clamped, { shouldDirty: true })
    setValue('endTime', endTimeFromDuration(startTime, clamped), {
      shouldDirty: true,
    })
  }

  const applyEndTime = (et: string) => {
    setValue('endTime', et, { shouldDirty: true })
    const d = durationFromEndTime(startTime, et)
    if (d != null) setValue('durationMinutes', d, { shouldDirty: true })
  }

  const handleDurationInputChange = (value: string) => {
    setValue('durationMinutes', value, {
      shouldDirty: true,
      shouldValidate: false,
    })
    const parsed = parseOptionalLocalizedInteger(value)
    if (parsed == null) return
    setValue('endTime', endTimeFromDuration(startTime, parsed), {
      shouldDirty: true,
    })
  }

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: isDirty && !isSubmitting,
    onClose: () => onOpenChange(false),
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      resetFormForInitialSlot()
      onOpenChange(true)
      return
    }
    requestClose(false)
  }

  const wasOpenRef = useRef(open)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetFormForInitialSlot()
    }
    wasOpenRef.current = open
  }, [open, resetFormForInitialSlot])

  useEffect(() => {
    if (!open) return
    const st = formatTimeHm(parseTimeHm(initialTime))
    setValue('date', initialDate)
    setValue('startTime', st)
    setValue('endTime', endTimeFromDuration(st, durationMinutes))
  }, [durationMinutes, initialDate, initialTime, open, setValue])

  useEffect(() => {
    if (open && useTemporaryClient) {
      requestAnimationFrame(() => setFocus('temporaryClientName'))
    }
  }, [open, setFocus, useTemporaryClient])

  const handleServiceChange = (id: string) => {
    const next = resolveIntakeServiceChange({
      serviceId: id,
      staffId: staffId ?? '',
      staffRoleOnly,
      services,
    })
    setValue('serviceId', next.serviceId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue('addonIds', next.addonIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue('staffId', next.staffId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    applyDuration(next.durationMinutes)
  }

  const toggleAddon = (addon: ServiceAddon) => {
    const next = resolveIntakeAddonToggle({
      addon,
      addonIds,
      availableAddons,
      selectedService,
      fallbackDuration: durationMinutes,
    })
    setValue('addonIds', next.addonIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
    applyDuration(next.durationMinutes)
  }

  const handleStaffChange = (id: string) => {
    setValue('staffId', id, { shouldDirty: true, shouldValidate: true })
    const next = resolveIntakeStaffChange({
      staffId: id,
      serviceId: serviceId ?? '',
      staffRoleOnly,
      services,
    })
    if (next.serviceId !== serviceId) {
      setValue('serviceId', next.serviceId, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
    if (next.durationMinutes != null) {
      applyDuration(next.durationMinutes)
    }
  }

  const handleClientCreated = (newClient: Client) => {
    setLocalClients((prev) => [newClient, ...prev])
    onClientsChanged?.()
  }

  const { createAppointment } = useAppointmentIntakeMutations()

  const onSubmit = handleSubmit(async (values) => {
    const validationError = validateAppointmentIntakeSubmit({
      values,
      activeServices,
      staffRoleOnly,
      serviceIdsWithStaff,
    })
    if (validationError) {
      setError(validationError.field, { message: validationError.message })
      return
    }

    try {
      const created = await createAppointment.mutateAsync(values)
      onSuccess(created)
    } catch {
      // Toast handled by mutation cache.
    }
  })

  useEffect(() => {
    if (staffId && staffSlotOk[staffId] === false) {
      setValue('staffId', '', { shouldDirty: true, shouldValidate: true })
    }
  }, [setValue, staffSlotOk, staffId])

  const durationLabel = `${toPersianDigits(durationMinutes)} دقیقه`
  const endTimeLabel = toPersianDigits(endTime)
  const priceLabel = `${tomansFormatter.format(previewPrice)} تومان`

  return (
    <FormSheet open={open} onOpenChange={handleOpenChange}>
      <FormSheetContent onRequestClose={() => requestClose(false)}>
        <FormSheetHeader className="pb-3">
          <FormSheetTitle>نوبت جدید</FormSheetTitle>
          <FormSheetDescription>
            خدمت، پرسنل و زمان نوبت را انتخاب کنید.
          </FormSheetDescription>
        </FormSheetHeader>

        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 overflow-auto px-5 pb-4"
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>
                مشتری <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="space-y-3">
                <label
                  htmlFor="temporary-client-mode"
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-blush-soft px-3 py-3"
                >
                  <Checkbox
                    id="temporary-client-mode"
                    checked={useTemporaryClient}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true
                      setValue('useTemporaryClient', enabled, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      if (enabled) {
                        setValue('clientId', '', { shouldDirty: true })
                        return
                      }
                      setValue('temporaryClientName', '', {
                        shouldDirty: true,
                      })
                      setValue('temporaryClientNotes', '', {
                        shouldDirty: true,
                      })
                    }}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      بعداً اطلاعات مشتری را کامل می‌کنم
                    </p>
                    <p className="text-xs text-muted-foreground">
                      برای این حالت فقط نام لازم است و بعداً می‌توانید شماره را
                      تکمیل کنید.
                    </p>
                  </div>
                </label>

                {useTemporaryClient ? (
                  <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <Field className="gap-2">
                      <FieldLabel htmlFor="temporary-client-name">
                        نام مشتری
                      </FieldLabel>
                      <Input
                        id="temporary-client-name"
                        {...register('temporaryClientName')}
                        placeholder="مثلاً دوستِ سارا"
                      />
                      {errors.temporaryClientName && (
                        <FieldError>
                          {errors.temporaryClientName.message}
                        </FieldError>
                      )}
                    </Field>

                    <Field className="gap-2">
                      <FieldLabel htmlFor="temporary-client-notes">
                        یادداشت (اختیاری)
                      </FieldLabel>
                      <Input
                        id="temporary-client-notes"
                        {...register('temporaryClientNotes')}
                        placeholder="مثلاً شماره را بعداً می‌گیرم"
                      />
                    </Field>
                  </div>
                ) : (
                  <ClientPicker
                    clients={localClients}
                    value={clientId ?? ''}
                    onChange={(id) =>
                      setValue('clientId', id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onClientCreated={handleClientCreated}
                  />
                )}
                {errors.clientId && (
                  <FieldError>{errors.clientId.message}</FieldError>
                )}
              </div>
            </Field>

            <div className="flex min-w-0 flex-col gap-4">
              <Field>
                <FieldLabel>
                  خدمت <span className="text-destructive">*</span>
                </FieldLabel>
                <Controller
                  control={control}
                  name="serviceId"
                  render={({ field }) => (
                    <ServicePicker
                      services={activeServices}
                      value={field.value || undefined}
                      onChange={handleServiceChange}
                      getDisabledReason={serviceDisabledReason}
                    />
                  )}
                />
                {errors.serviceId && (
                  <FieldError>{errors.serviceId.message}</FieldError>
                )}
              </Field>

              {selectedService ? (
                <Field>
                  <FieldLabel>افزودنی‌ها (اختیاری)</FieldLabel>
                  {addonsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Spinner className="size-3.5" />
                      در حال دریافت افزودنی‌ها...
                    </div>
                  ) : availableAddons.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {availableAddons.map((addon) => {
                          const selected = addonIds.includes(addon.id)
                          return (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={() => toggleAddon(addon)}
                              title={`+${toPersianDigits(addon.durationDelta)} دقیقه · +${tomansFormatter.format(addon.priceDelta)} تومان`}
                              className={cn(
                                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                                selected
                                  ? 'border-transparent bg-primary text-primary-foreground'
                                  : 'border-transparent bg-blush-soft text-foreground hover:bg-secondary/60',
                              )}
                            >
                              {selected ? <Check className="size-3.5" /> : null}
                              {addon.name}
                            </button>
                          )
                        })}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        جمع پیش‌نمایش: {toPersianDigits(previewDuration)} دقیقه
                        · {priceLabel}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      برای این خدمت افزودنی فعالی تعریف نشده است.
                    </p>
                  )}
                </Field>
              ) : null}

              <Field>
                <FieldLabel>پرسنل</FieldLabel>
                <StaffPicker
                  staff={staffRoleOnly}
                  value={staffId || undefined}
                  onChange={handleStaffChange}
                  getStatus={staffPickerStatus}
                />
                {errors.staffId && (
                  <FieldError>{errors.staffId.message}</FieldError>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="date">
                  تاریخ <span className="text-destructive">*</span>
                </FieldLabel>
                <JalaliDatePicker
                  id="date"
                  value={date}
                  onChange={(value) =>
                    setValue('date', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  required
                />
                {errors.date && <FieldError>{errors.date.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="time">
                  ساعت <span className="text-destructive">*</span>
                </FieldLabel>
                <TimePicker
                  id="time"
                  value={startTime}
                  onChange={(st) => {
                    setValue('startTime', st, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    setValue(
                      'endTime',
                      endTimeFromDuration(st, durationMinutes),
                      {
                        shouldDirty: true,
                        shouldValidate: true,
                      },
                    )
                  }}
                  label="ساعت شروع"
                />
                {errors.startTime && (
                  <FieldError>{errors.startTime.message}</FieldError>
                )}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="notes">یادداشت (اختیاری)</FieldLabel>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
                placeholder="توضیحات اضافی درباره این نوبت…"
              />
            </Field>

            <details className="group rounded-lg border border-transparent bg-blush-soft">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium touch-manipulation [&::-webkit-details-marker]:hidden">
                <span>جزئیات زمان</span>
                <span className="flex min-w-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                  <span className="tabular-nums" dir="ltr">
                    {endTimeLabel}
                  </span>
                  <span className="truncate">{durationLabel}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  />
                </span>
              </summary>
              <FieldGroup className="gap-4 border-t border-border/60 px-3 py-4">
                <Field>
                  <FieldLabel>مدت (دقیقه)</FieldLabel>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {DURATION_PRESETS.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant={durationMinutes === m ? 'default' : 'outline'}
                        onClick={() => applyDuration(m)}
                      >
                        {new Intl.NumberFormat('fa-IR').format(m)}
                      </Button>
                    ))}
                  </div>
                  <LocalizedNumberInput
                    id="duration"
                    value={durationInput}
                    onValueChange={handleDurationInputChange}
                    onBlur={() => {
                      void trigger('durationMinutes')
                    }}
                  />
                  {errors.durationMinutes && (
                    <FieldError>{errors.durationMinutes.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="end-time">پایان</FieldLabel>
                  <TimePicker
                    id="end-time"
                    value={endTime}
                    onChange={applyEndTime}
                    label="ساعت پایان"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    تغییر پایان، مدت را هم‌زمان به‌روز می‌کند.
                  </p>
                  {errors.endTime && (
                    <FieldError>{errors.endTime.message}</FieldError>
                  )}
                </Field>
              </FieldGroup>
            </details>

            <FormRootError message={errors.root?.message} />
          </FieldGroup>
        </form>

        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              !serviceId ||
              !staffId ||
              !selectedServiceHasStaff ||
              !selectedStaffHasServices ||
              !selectedStaffCanPerformSelectedService ||
              (useTemporaryClient ? !temporaryClientName?.trim() : !clientId)
            }
          >
            {isSubmitting && <Spinner className="ml-2" />}
            {isSubmitting ? 'در حال ثبت…' : 'ثبت نوبت'}
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
    </FormSheet>
  )
}
