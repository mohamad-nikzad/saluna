import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useManagerMutation } from '#/lib/use-manager-mutation'
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
  autoPickServiceForStaff,
  eligibleServicesForStaff,
  eligibleStaffForService,
} from '@repo/salon-core/staff-service-autofill'
import {
  APPOINTMENT_DURATION_BOUNDS,
  durationMinutesFromRange,
  endTimeFromDuration,
  formatTimeHm,
  parseTimeHm,
  validateAppointmentWindow,
} from '@repo/salon-core/appointment-time'
import { ClientPicker } from '#/components/calendar/client-picker'
import { useServiceAddons } from '#/lib/use-service-addons'
import { useStaffBookingAvailability } from '#/lib/use-staff-booking-availability'
import { ServicePicker } from '#/components/services/service-picker'
import { useNetworkStatus } from '#/lib/network-status'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import {
  parseLocalizedInt,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import { appointmentFormSchema } from '@repo/salon-core/forms/appointment'
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'

const DURATION_PRESETS = [30, 45, 60, 90, 120]
const tomansFormatter = new Intl.NumberFormat('fa-IR')

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
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form

  const clientId = watch('clientId')
  const staffId = watch('staffId')
  const serviceId = watch('serviceId')
  const date = watch('date')
  const startTime = watch('startTime')
  const durationMinutes = Number(watch('durationMinutes')) || 45
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
  const activeServices = useMemo(
    () => services.filter((service) => service.active),
    [services],
  )
  const staffRoleOnly = useMemo(
    () => staff.filter((m) => m.role === 'staff'),
    [staff],
  )
  const selectedStaff = useMemo(
    () => staffRoleOnly.find((member) => member.id === staffId),
    [staffId, staffRoleOnly],
  )
  const selectedService = useMemo(
    () => activeServices.find((service) => service.id === serviceId),
    [activeServices, serviceId],
  )
  const selectedAddons = useMemo(
    () => availableAddons.filter((addon) => addonIds.includes(addon.id)),
    [addonIds, availableAddons],
  )
  const previewDuration =
    (selectedService?.duration ?? durationMinutes) +
    selectedAddons.reduce((sum, addon) => sum + addon.durationDelta, 0)
  const previewPrice =
    (selectedService?.price ?? 0) +
    selectedAddons.reduce((sum, addon) => sum + addon.priceDelta, 0)
  const serviceIdsWithStaff = useMemo(() => {
    const ids = new Set<string>()
    for (const service of activeServices) {
      if (eligibleStaffForService(staffRoleOnly, service.id).length > 0) {
        ids.add(service.id)
      }
    }
    return ids
  }, [activeServices, staffRoleOnly])
  const selectedStaffEligibleServiceIds = useMemo(() => {
    if (!selectedStaff) return new Set<string>()
    return new Set(
      eligibleServicesForStaff(selectedStaff, activeServices).map(
        (service) => service.id,
      ),
    )
  }, [activeServices, selectedStaff])
  const staffServiceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const member of staffRoleOnly) {
      counts.set(
        member.id,
        eligibleServicesForStaff(member, activeServices).length,
      )
    }
    return counts
  }, [activeServices, staffRoleOnly])
  const serviceIdsWithAvailableStaff = useMemo(() => {
    const ids = new Set<string>()
    for (const service of activeServices) {
      const eligible = eligibleStaffForService(staffRoleOnly, service.id)
      if (eligible.some((member) => staffSlotOk[member.id] !== false)) {
        ids.add(service.id)
      }
    }
    return ids
  }, [activeServices, staffRoleOnly, staffSlotOk])
  const serviceDisabledReason = useCallback(
    (service: Service) => {
      if (!serviceIdsWithStaff.has(service.id)) return 'بدون پرسنل'
      if (!serviceIdsWithAvailableStaff.has(service.id)) {
        return 'پرسنل در دسترس نیست'
      }
      if (selectedStaff && !selectedStaffEligibleServiceIds.has(service.id)) {
        return 'برای این پرسنل نیست'
      }
      return null
    },
    [
      selectedStaff,
      selectedStaffEligibleServiceIds,
      serviceIdsWithAvailableStaff,
      serviceIdsWithStaff,
    ],
  )
  const selectedServiceHasStaff =
    !selectedService || serviceIdsWithStaff.has(selectedService.id)
  const selectedStaffHasServices =
    !staffId || (staffServiceCounts.get(staffId) ?? 0) > 0
  const selectedStaffCanPerformSelectedService =
    !staffId ||
    !serviceId ||
    Boolean(selectedStaff && selectedStaffEligibleServiceIds.has(serviceId))

  useEffect(() => {
    setLocalClients(clients)
  }, [clients])

  const resetFormForInitialSlot = useCallback(() => {
    const initialService = initialServiceId
      ? services.find((service) => service.id === initialServiceId)
      : undefined
    const defaultDuration = initialService?.duration ?? 45
    const st = formatTimeHm(parseTimeHm(initialTime))

    reset({
      useTemporaryClient: false,
      clientId: initialClientId ?? '',
      staffId: initialStaffId ?? '',
      serviceId: initialServiceId ?? '',
      date: initialDate,
      startTime: st,
      endTime: endTimeFromDuration(st, defaultDuration),
      durationMinutes: defaultDuration,
      notes: '',
      temporaryClientName: '',
      temporaryClientNotes: '',
      addonIds: [],
    })
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
    const clamped = Math.min(
      APPOINTMENT_DURATION_BOUNDS.max,
      Math.max(APPOINTMENT_DURATION_BOUNDS.min, mins),
    )
    setValue('durationMinutes', clamped, { shouldDirty: true })
    setValue('endTime', endTimeFromDuration(startTime, clamped), {
      shouldDirty: true,
    })
  }

  const applyEndTime = (et: string) => {
    setValue('endTime', et, { shouldDirty: true })
    try {
      const d = durationMinutesFromRange(startTime, et)
      if (d > 0) setValue('durationMinutes', d, { shouldDirty: true })
    } catch {
      /* invalid time */
    }
  }

  const applyCatalogDuration = (
    baseService: Service | undefined,
    addons: ServiceAddon[],
  ) => {
    applyDuration(
      (baseService?.duration ?? 45) +
        addons.reduce((sum, addon) => sum + addon.durationDelta, 0),
    )
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
    setValue('serviceId', id, { shouldDirty: true, shouldValidate: true })
    setValue('addonIds', [], { shouldDirty: true, shouldValidate: true })
    const svc = services.find((s) => s.id === id)
    if (svc) applyDuration(svc.duration)

    const eligibleStaffMembers = eligibleStaffForService(staffRoleOnly, id)
    const currentStillEligible =
      !!staffId && eligibleStaffMembers.some((m) => m.id === staffId)
    if (currentStillEligible) return
    if (eligibleStaffMembers.length > 0) {
      setValue('staffId', eligibleStaffMembers[0].id, {
        shouldDirty: true,
        shouldValidate: true,
      })
    } else {
      setValue('staffId', '', { shouldDirty: true, shouldValidate: true })
    }
  }

  const toggleAddon = (addon: ServiceAddon) => {
    const nextIds = addonIds.includes(addon.id)
      ? addonIds.filter((id) => id !== addon.id)
      : [...addonIds, addon.id]
    const nextAddons = availableAddons.filter((item) =>
      nextIds.includes(item.id),
    )
    setValue('addonIds', nextIds, { shouldDirty: true, shouldValidate: true })
    applyCatalogDuration(selectedService, nextAddons)
  }

  const handleStaffChange = (id: string) => {
    setValue('staffId', id, { shouldDirty: true, shouldValidate: true })
    const member = staff.find((s) => s.id === id)
    if (!member) return

    const eligible = eligibleServicesForStaff(member, services)
    const current = services.find((s) => s.id === serviceId)
    const serviceStillOk = !!current && eligible.some((s) => s.id === serviceId)

    if (!serviceStillOk) {
      const explicitList =
        member.serviceIds != null && member.serviceIds.length > 0
      const auto = autoPickServiceForStaff(eligible, {
        staffHasExplicitServiceList: explicitList,
      })
      if (auto) {
        setValue('serviceId', auto.id, {
          shouldDirty: true,
          shouldValidate: true,
        })
        applyDuration(auto.duration)
      } else {
        setValue('serviceId', '', { shouldDirty: true, shouldValidate: true })
      }
    }
  }

  const handleClientCreated = (newClient: Client) => {
    setLocalClients((prev) => [newClient, ...prev])
    onClientsChanged?.()
  }

  const createAppointment = useManagerMutation(
    async (dc, values: AppointmentFormInput) => {
      const payload = appointmentFormSchema.parse(values)
      return dc.appointments.create(payload)
    },
  )

  const onSubmit = handleSubmit(async (values) => {
    const currentService = activeServices.find(
      (service) => service.id === values.serviceId,
    )
    const currentStaff = staffRoleOnly.find(
      (member) => member.id === values.staffId,
    )
    if (currentService && !serviceIdsWithStaff.has(currentService.id)) {
      setError('serviceId', {
        message: 'برای این خدمت هنوز پرسنلی تعریف نشده است.',
      })
      return
    }
    if (
      currentStaff &&
      eligibleServicesForStaff(currentStaff, activeServices).length === 0
    ) {
      setError('staffId', {
        message: 'برای این پرسنل هنوز خدمتی تعریف نشده است.',
      })
      return
    }
    if (
      currentStaff &&
      currentService &&
      !eligibleServicesForStaff(currentStaff, activeServices).some(
        (service) => service.id === currentService.id,
      )
    ) {
      setError('staffId', {
        message: 'این پرسنل نمی‌تواند خدمت انتخاب‌شده را انجام دهد.',
      })
      return
    }

    const localCheck = validateAppointmentWindow(
      values.startTime,
      values.endTime,
    )
    if (!localCheck.ok) {
      setError('root', { message: localCheck.error })
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
                  getStatus={(member) => {
                    const unavailable = staffSlotOk[member.id] === false
                    const noServices =
                      (staffServiceCounts.get(member.id) ?? 0) === 0
                    const serviceMismatch =
                      !!serviceId &&
                      !eligibleStaffForService([member], serviceId).length
                    if (unavailable)
                      return { disabled: true, reason: 'خارج از برنامه' }
                    if (noServices)
                      return { disabled: true, reason: 'خدمتی ندارد' }
                    if (serviceMismatch)
                      return {
                        disabled: true,
                        reason: 'این خدمت را انجام نمی‌دهد',
                      }
                    return undefined
                  }}
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
                  <Input
                    id="duration"
                    type="text"
                    inputMode="numeric"
                    value={toPersianDigits(durationMinutes)}
                    onChange={(e) => {
                      const v = parseLocalizedInt(
                        e.target.value,
                        durationMinutes,
                      )
                      if (!Number.isFinite(v)) return
                      applyDuration(v)
                    }}
                    dir="rtl"
                    className="text-right tabular-nums"
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
