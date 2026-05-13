'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Checkbox } from '@repo/ui/checkbox'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { ChevronDown } from 'lucide-react'
import {
  User,
  Service,
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
import { ClientPicker } from '@/components/calendar/client-picker'
import { useManagerDataClient } from '@/components/manager-data-client-provider'
import { ServicePicker } from '@/components/services/service-picker'
import { DataClientHttpError } from '@repo/data-client'
import { useNetworkStatus } from '@/lib/pwa-client'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import {
  parseLocalizedInt,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  appointmentFormSchema,
  type AppointmentFormInput,
} from '@repo/salon-core/forms/appointment'

const DURATION_PRESETS = [30, 45, 60, 90, 120]

interface AppointmentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate: string
  initialTime: string
  initialStaffId?: string
  initialServiceId?: string
  /** When set while opening, pre-selects this client (e.g. deep link from client profile). */
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
  const dataClient = useManagerDataClient()
  const isOnline = useNetworkStatus()
  const [localClients, setLocalClients] = useState<Client[]>(clients)
  const [staffSlotOk, setStaffSlotOk] = useState<Record<string, boolean>>({})
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
    formState: { errors, isSubmitting },
  } = form

  const clientId = watch('clientId') ?? ''
  const staffId = watch('staffId') ?? ''
  const serviceId = watch('serviceId') ?? ''
  const date = watch('date')
  const startTime = watch('startTime') ?? '09:00'
  const durationMinutes = Number(watch('durationMinutes')) || 45
  const endTime =
    watch('endTime') ?? endTimeFromDuration(startTime, durationMinutes)
  const useTemporaryClient = Boolean(watch('useTemporaryClient'))
  const temporaryClientName = watch('temporaryClientName') ?? ''
  const activeServices = useMemo(
    () => services.filter((service) => service.active),
    [services],
  )

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

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      resetFormForInitialSlot()
    }
    onOpenChange(isOpen)
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
    const svc = services.find((s) => s.id === id)
    if (svc) applyDuration(svc.duration)

    const eligibleAll = eligibleStaffForService(staff, id)
    const eligibleStaffMembers = eligibleStaffForService(staffRoleOnly, id)
    if (eligibleStaffMembers.length === 1) {
      setValue('staffId', eligibleStaffMembers[0].id, {
        shouldDirty: true,
        shouldValidate: true,
      })
    } else if (!eligibleAll.some((m) => m.id === staffId)) {
      setValue('staffId', '', { shouldDirty: true, shouldValidate: true })
    }
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

  const onSubmit = handleSubmit(async (values) => {
    const localCheck = validateAppointmentWindow(
      values.startTime,
      values.endTime,
    )
    if (!localCheck.ok) {
      setError('root', { message: localCheck.error })
      return
    }

    try {
      const payload = appointmentFormSchema.parse(values)
      if (dataClient) {
        const created = await dataClient.appointments.create(payload)
        void dataClient.sync.processPending()
        onSuccess(created)
        return
      }

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError('root', { message: data.error || 'خطا در ثبت نوبت' })
        return
      }

      if (!data.appointment) {
        setError('root', { message: 'پاسخ ثبت نوبت کامل نبود' })
        return
      }

      onSuccess(data.appointment)
    } catch (err) {
      setError('root', {
        message:
          err instanceof DataClientHttpError ? err.message : 'خطایی رخ داد',
      })
    }
  })

  /** Managers are often unrestricted; autofill only among real staff to avoid false ambiguity. */
  const staffRoleOnly = useMemo(
    () => staff.filter((m) => m.role === 'staff'),
    [staff],
  )

  useEffect(() => {
    if (!open || !date || !startTime || !endTime || !isOnline) return
    const wc = validateAppointmentWindow(startTime, endTime)
    if (!wc.ok) {
      setStaffSlotOk({})
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ date, startTime, endTime })
        const res = await fetch(`/api/staff/booking-availability?${qs}`, {
          credentials: 'include',
          signal: ctrl.signal,
        })
        const json = (await res.json()) as {
          staff?: Array<{ staffId: string; available: boolean }>
        }
        if (!res.ok) return
        const next: Record<string, boolean> = {}
        for (const row of json.staff ?? []) {
          next[row.staffId] = row.available
        }
        setStaffSlotOk(next)
      } catch {
        /* aborted */
      }
    }, 280)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [open, date, startTime, endTime, isOnline])

  useEffect(() => {
    if (staffId && staffSlotOk[staffId] === false) {
      setValue('staffId', '', { shouldDirty: true, shouldValidate: true })
    }
  }, [setValue, staffSlotOk, staffId])

  const durationLabel = `${toPersianDigits(durationMinutes)} دقیقه`
  const endTimeLabel = toPersianDigits(endTime)

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[96lvh]">
        <DrawerHeader className="pb-3">
          <DrawerTitle>نوبت جدید</DrawerTitle>
          <DrawerDescription>
            خدمت، پرسنل و زمان نوبت را انتخاب کنید.
          </DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 overflow-auto px-4 pb-4"
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>مشتری</FieldLabel>
              <div className="space-y-3">
                <label
                  htmlFor="temporary-client-mode"
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
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
                    value={clientId}
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

            {/* Nested column so staff always stacks above service (stable in RTL / flex layouts). */}
            <div className="flex min-w-0 flex-col gap-4">
              <Field>
                <FieldLabel>پرسنل</FieldLabel>
                <Controller
                  control={control}
                  name="staffId"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={handleStaffChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="انتخاب پرسنل" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffRoleOnly.map((member) => {
                          const unavailable = staffSlotOk[member.id] === false
                          return (
                            <SelectItem
                              key={member.id}
                              value={member.id}
                              disabled={unavailable}
                            >
                              {member.name}
                              {unavailable ? ' (خارج از برنامه)' : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.staffId && (
                  <FieldError>{errors.staffId.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel>خدمت</FieldLabel>
                <Controller
                  control={control}
                  name="serviceId"
                  render={({ field }) => (
                    <ServicePicker
                      services={activeServices}
                      value={field.value || undefined}
                      onChange={handleServiceChange}
                    />
                  )}
                />
                {errors.serviceId && (
                  <FieldError>{errors.serviceId.message}</FieldError>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="date">تاریخ</FieldLabel>
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
                <FieldLabel htmlFor="time">شروع</FieldLabel>
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

            <details className="group rounded-lg border border-border bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium touch-manipulation [&::-webkit-details-marker]:hidden">
                <span>جزئیات زمان و توضیحات</span>
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

                <Field>
                  <FieldLabel htmlFor="notes">توضیحات (اختیاری)</FieldLabel>
                  <Input
                    id="notes"
                    {...register('notes')}
                    placeholder="توضیحات اضافی…"
                  />
                </Field>
              </FieldGroup>
            </details>

            <FormRootError message={errors.root?.message} />
          </FieldGroup>
        </form>

        <DrawerFooter>
          <Button
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              !serviceId ||
              !staffId ||
              (useTemporaryClient ? !temporaryClientName.trim() : !clientId)
            }
          >
            {isSubmitting && <Spinner className="ml-2" />}
            {isSubmitting ? 'در حال ثبت…' : 'ثبت نوبت'}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">انصراف</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
