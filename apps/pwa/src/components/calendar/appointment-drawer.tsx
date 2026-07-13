import {
  memo,
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  type ComponentProps,
} from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  FormSheet,
  FormSheetContent,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetFooter,
} from '#/components/form-sheet'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'
import { Button } from '@repo/ui/button'
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
  ServicePackage,
} from '@repo/salon-core/types'
import { endTimeFromDuration } from '@repo/salon-core/appointment-time'
import { AppointmentClientField } from '#/components/calendar/appointment-client-field'
import {
  appointmentCreateFormDefaults,
  calculatedAppointmentPrice,
  applyTemporaryClientModePatch,
  buildAppointmentCreateViewModel,
  clampAppointmentDuration,
  durationFromEndTime,
  resolveIntakeAddonToggle,
  resolveIntakeServiceChange,
  resolveIntakeStaffChange,
  resolveTemporaryClientModeChange,
  validateAppointmentIntakeSubmit,
} from '#/lib/appointment-intake'
import {
  tomansFormatter,
  useStaffBookingAvailability,
} from '#/lib/appointment-surface'
import { useServiceAddons } from '#/lib/use-service-addons'
import { useAppointmentIntakeMutations } from '#/lib/use-appointment-intake-mutations'
import { ServicePicker } from '#/components/services/service-picker'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { appointmentFormSchema } from '@repo/salon-core/forms/appointment'
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'
import {
  LocalizedNumberInput,
  parseOptionalLocalizedInteger,
} from '#/components/localized-number-input'
import { PackageBookingForm } from '#/components/calendar/package-booking-form'

const DURATION_PRESETS = [30, 45, 60, 90, 120]
type BookingMode = 'single' | 'package'

interface AppointmentDrawerProps {
  formRevision?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string
  initialTime: string
  initialStaffId?: string
  initialServiceId?: string
  initialClientId?: string
  packages?: ServicePackage[]
  staff: User[]
  services: Service[]
  clients: Client[]
  onSuccess: (appointment: AppointmentWithDetails) => void
  onPackageBooked?: () => void
  onClientsChanged?: () => void
}

const AppointmentDrawerActiveContext = createContext(false)

function ActiveAppointmentClientField({
  ...props
}: Omit<ComponentProps<typeof AppointmentClientField>, 'hostActive'>) {
  const active = useContext(AppointmentDrawerActiveContext)
  return <AppointmentClientField {...props} hostActive={active} />
}

function ActivePackageBookingForm({
  ...props
}: Omit<ComponentProps<typeof PackageBookingForm>, 'active'>) {
  const active = useContext(AppointmentDrawerActiveContext)
  return <PackageBookingForm {...props} active={active} />
}

function TemporaryClientFocus({
  enabled,
  focus,
}: {
  enabled: boolean
  focus: () => void
}) {
  const active = useContext(AppointmentDrawerActiveContext)

  useEffect(() => {
    if (active && enabled) requestAnimationFrame(focus)
  }, [active, enabled, focus])

  return null
}

const AppointmentDrawerForm = memo(function AppointmentDrawerForm({
  formRevision = 0,
  onOpenChange,
  initialDate,
  initialTime,
  initialStaffId,
  initialServiceId,
  initialClientId,
  packages = [],
  staff,
  services,
  clients,
  onSuccess,
  onPackageBooked,
  onClientsChanged,
}: Omit<AppointmentDrawerProps, 'open'>) {
  const [localClients, setLocalClients] = useState<Client[]>(clients)
  const [mode, setMode] = useState<BookingMode>('single')
  const finalPriceOverriddenRef = useRef(false)
  const form = useForm<AppointmentFormInput>({
    resolver: zodResolver(appointmentFormSchema, undefined, { raw: true }),
    defaultValues: appointmentCreateFormDefaults({
      initialDate,
      initialTime,
      initialStaffId,
      initialServiceId,
      initialClientId,
      services,
    }),
  })
  const {
    control,
    getValues,
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
    setValue,
    trigger,
    watch,
    formState: { errors, isDirty, isSubmitted, isSubmitting, touchedFields },
  } = form

  const clientId = watch('clientId')
  const staffId = watch('staffId')
  const serviceId = watch('serviceId')
  const date = watch('date')
  const startTime = watch('startTime')
  const durationInput = watch('durationMinutes')
  const finalPriceInput = watch('finalPrice')
  const durationMinutes = parseOptionalLocalizedInteger(durationInput) ?? 45
  const endTime =
    watch('endTime') || endTimeFromDuration(startTime, durationMinutes)
  const useTemporaryClient = Boolean(watch('useTemporaryClient'))
  const temporaryClientName = watch('temporaryClientName') ?? ''
  const temporaryClientNotes = watch('temporaryClientNotes') ?? ''
  const addonIds = watch('addonIds') ?? []
  const staffSlotOk = useStaffBookingAvailability(
    true,
    date,
    startTime,
    endTime,
  )
  const { data: availableAddons = [], isPending: addonsLoading } =
    useServiceAddons(serviceId ?? '', !!serviceId)
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
    serviceStatusReason,
    staffPickerStatus,
    selectedServiceHasStaff,
    selectedStaffHasServices,
    selectedStaffCanPerformSelectedService,
  } = createViewModel

  useEffect(() => {
    setLocalClients(clients)
  }, [clients])

  const formRevisionRef = useRef(formRevision)
  useLayoutEffect(() => {
    if (formRevisionRef.current === formRevision) return
    formRevisionRef.current = formRevision
    finalPriceOverriddenRef.current = false
    const nextDefaults = appointmentCreateFormDefaults({
      initialDate,
      initialTime,
      initialStaffId,
      initialServiceId,
      initialClientId,
      services,
    })
    const needsReset =
      isDirty ||
      isSubmitted ||
      Object.keys(errors).length > 0 ||
      Object.keys(touchedFields).length > 0 ||
      JSON.stringify(getValues()) !== JSON.stringify(nextDefaults)
    if (needsReset) {
      reset(nextDefaults)
    }
    setLocalClients(clients)
    setMode('single')
  }, [
    clients,
    errors,
    formRevision,
    getValues,
    initialClientId,
    initialDate,
    initialServiceId,
    initialStaffId,
    initialTime,
    isDirty,
    isSubmitted,
    reset,
    services,
    touchedFields,
  ])

  const applyDuration = (mins: number) => {
    const clamped = clampAppointmentDuration(mins)
    setValue('durationMinutes', clamped, { shouldDirty: true })
    setValue('endTime', endTimeFromDuration(startTime, clamped), {
      shouldDirty: true,
    })
  }

  const applyCalculatedFinalPrice = (
    service: Service | undefined,
    addons: ServiceAddon[] = [],
  ) => {
    if (finalPriceOverriddenRef.current) return
    setValue('finalPrice', calculatedAppointmentPrice(service, addons), {
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
    applyCalculatedFinalPrice(
      services.find((service) => service.id === next.serviceId),
    )
  }

  const clearService = () => {
    setValue('serviceId', '', { shouldDirty: true, shouldValidate: true })
    setValue('addonIds', [], { shouldDirty: true, shouldValidate: true })
    applyCalculatedFinalPrice(undefined)
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
    const nextAddons = availableAddons.filter((item) =>
      next.addonIds.includes(item.id),
    )
    applyCalculatedFinalPrice(selectedService, nextAddons)
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
      applyCalculatedFinalPrice(
        services.find((service) => service.id === next.serviceId),
      )
    }
    if (next.durationMinutes != null) {
      applyDuration(next.durationMinutes)
    }
  }

  const clearStaff = () => {
    setValue('staffId', '', { shouldDirty: true, shouldValidate: true })
  }

  const handleClientCreated = (newClient: Client) => {
    setLocalClients((prev) => [newClient, ...prev])
    onClientsChanged?.()
  }

  const handleTemporaryClientModeChange = (enabled: boolean) => {
    applyTemporaryClientModePatch(
      resolveTemporaryClientModeChange(enabled),
      setValue,
    )
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
  const canCreatePackage = packages.length > 0 && staff.length > 0
  const closeActiveMode = () => {
    if (mode === 'single') requestClose(false)
    else onOpenChange(false)
  }
  const tabClass = (selected: boolean) =>
    cn(
      'min-h-9 rounded-lg px-3 text-xs font-bold transition-colors',
      selected
        ? 'bg-card text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
    )

  return (
    <>
      <FormSheetContent forceMount onRequestClose={closeActiveMode}>
        <TemporaryClientFocus
          enabled={useTemporaryClient}
          focus={() => setFocus('temporaryClientName')}
        />
        <FormSheetHeader className="gap-2 pb-2">
          <FormSheetTitle className="text-base">
            {mode === 'single' ? 'ثبت نوبت' : 'ثبت پکیج'}
          </FormSheetTitle>
          <div className="rounded-xl bg-muted/70 p-0.5">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={tabClass(mode === 'single')}
                aria-pressed={mode === 'single'}
              >
                نوبت تکی
              </button>
              <button
                type="button"
                onClick={() => setMode('package')}
                disabled={!canCreatePackage}
                className={tabClass(mode === 'package')}
                aria-pressed={mode === 'package'}
              >
                پکیج خدمات
              </button>
            </div>
          </div>
        </FormSheetHeader>

        {mode === 'single' ? (
          <>
            <form
              onSubmit={onSubmit}
              className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-4"
              onFocus={handleFormFocusScroll}
            >
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel>
                    مشتری <span className="text-destructive">*</span>
                  </FieldLabel>
                  <ActiveAppointmentClientField
                    checkboxId="temporary-client-mode"
                    useTemporaryClient={useTemporaryClient}
                    onTemporaryClientModeChange={
                      handleTemporaryClientModeChange
                    }
                    togglePlacement="below"
                    toggleVariant="subtle"
                    clients={localClients}
                    clientId={clientId ?? ''}
                    contactActionPlacement="beside"
                    onClientChange={(id) =>
                      setValue('clientId', id, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onClientCreated={handleClientCreated}
                    clientIdError={errors.clientId?.message}
                    temporaryClientName={temporaryClientName}
                    onTemporaryClientNameChange={(value) =>
                      setValue('temporaryClientName', value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    temporaryClientNameError={
                      errors.temporaryClientName?.message
                    }
                    temporaryClientNotes={temporaryClientNotes}
                    onTemporaryClientNotesChange={(value) =>
                      setValue('temporaryClientNotes', value, {
                        shouldDirty: true,
                      })
                    }
                  />
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
                          onClear={clearService}
                          getDisabledReason={serviceDisabledReason}
                          getStatusReason={serviceStatusReason}
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
                                  {selected ? (
                                    <Check className="size-3.5" />
                                  ) : null}
                                  {addon.name}
                                </button>
                              )
                            })}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            جمع پیش‌نمایش: {toPersianDigits(previewDuration)}{' '}
                            دقیقه · {priceLabel}
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
                      onClear={clearStaff}
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
                    {errors.date && (
                      <FieldError>{errors.date.message}</FieldError>
                    )}
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
                  <FieldLabel htmlFor="final-price">
                    قیمت نهایی (تومان)
                  </FieldLabel>
                  <LocalizedNumberInput
                    id="final-price"
                    value={finalPriceInput}
                    onValueChange={(value) => {
                      finalPriceOverriddenRef.current = true
                      setValue('finalPrice', value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    onBlur={() => void trigger('finalPrice')}
                  />
                  {errors.finalPrice && (
                    <FieldError>{errors.finalPrice.message}</FieldError>
                  )}
                </Field>

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
                            variant={
                              durationMinutes === m ? 'default' : 'outline'
                            }
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
                        <FieldError>
                          {errors.durationMinutes.message}
                        </FieldError>
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

            <FormSheetFooter className="grid grid-cols-2 gap-2">
              <Button
                onClick={onSubmit}
                disabled={
                  isSubmitting ||
                  !serviceId ||
                  !staffId ||
                  !selectedServiceHasStaff ||
                  !selectedStaffHasServices ||
                  !selectedStaffCanPerformSelectedService ||
                  (useTemporaryClient
                    ? !temporaryClientName?.trim()
                    : !clientId)
                }
              >
                {isSubmitting && <Spinner className="ms-2" />}
                {isSubmitting ? 'در حال ثبت…' : 'ثبت نوبت'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeActiveMode}
                disabled={isSubmitting}
              >
                انصراف
              </Button>
            </FormSheetFooter>
          </>
        ) : (
          <ActivePackageBookingForm
            initialDate={initialDate}
            initialTime={initialTime}
            packages={packages}
            staff={staff}
            clients={clients}
            onSuccess={() => {
              onPackageBooked?.()
              onOpenChange(false)
            }}
            onCancel={closeActiveMode}
            onClientsChanged={onClientsChanged}
          />
        )}
      </FormSheetContent>
      {confirmDialog}
    </>
  )
})

export function AppointmentDrawer({ open, ...props }: AppointmentDrawerProps) {
  const [hasOpened, setHasOpened] = useState(open)

  useEffect(() => {
    if (open) setHasOpened(true)
  }, [open])

  return (
    <AppointmentDrawerActiveContext.Provider value={open}>
      <FormSheet open={open} onOpenChange={props.onOpenChange}>
        {hasOpened ? <AppointmentDrawerForm {...props} /> : null}
      </FormSheet>
    </AppointmentDrawerActiveContext.Provider>
  )
}
