'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  DrawerNested,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Checkbox } from '@repo/ui/checkbox'
import { Input } from '@repo/ui/input'
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
import { Badge } from '@repo/ui/badge'
import {
  User,
  Service,
  Client,
  AppointmentWithDetails,
  APPOINTMENT_STATUS,
} from '@repo/salon-core/types'
import {
  autoPickServiceForStaff,
  eligibleServicesForStaff,
  eligibleStaffForService,
} from '@repo/salon-core/staff-service-autofill'
import { cn } from '@repo/ui/utils'
import { Phone, Clock, Calendar, User as UserIcon, Trash2 } from 'lucide-react'
import {
  APPOINTMENT_DURATION_BOUNDS,
  durationMinutesFromRange,
  endTimeFromDuration,
  validateAppointmentWindow,
} from '@repo/salon-core/appointment-time'
import {
  appointmentFormSchema,
  completePlaceholderClientSchema,
  type AppointmentFormInput,
  type CompletePlaceholderClientInput,
} from '@repo/salon-core/forms/appointment'
import { ClientPicker } from '@/components/calendar/client-picker'
import { useManagerDataClient } from '@/components/manager-data-client-provider'
import { formatCompactServiceLabel } from '@/components/services/service-catalog-groups'
import { ServicePicker } from '@/components/services/service-picker'
import { DataClientHttpError } from '@repo/data-client'
import { useNetworkStatus } from '@/lib/pwa-client'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import { formatPersianTime, parseLocalizedInt, toPersianDigits } from '@repo/salon-core/persian-digits'

type StatusActionState = {
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'queued'
  message: string
} | null

function formatTomans(price: number) {
  return `${new Intl.NumberFormat('fa-IR').format(price)} تومان`
}

interface AppointmentDetailDrawerProps {
  appointment: AppointmentWithDetails | null
  onOpenChange: (open: boolean) => void
  staff: User[]
  services: Service[]
  clients: Client[]
  onSuccess: (change: AppointmentDetailChange) => void
  onClientsChanged?: () => void
  readOnly?: boolean
  canChangeStatus?: boolean
}

type AppointmentDetailChange =
  | { type: 'updated'; appointment: AppointmentWithDetails }
  | { type: 'deleted'; id: string }

export function AppointmentDetailDrawer({
  appointment,
  onOpenChange,
  staff,
  services,
  clients,
  onSuccess,
  onClientsChanged,
  readOnly = false,
  canChangeStatus = !readOnly,
}: AppointmentDetailDrawerProps) {
  const dataClient = useManagerDataClient()
  const isOnline = useNetworkStatus()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusAction, setStatusAction] = useState<StatusActionState>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCompleteClientDrawer, setShowCompleteClientDrawer] = useState(false)
  const [completeClientLoading, setCompleteClientLoading] = useState(false)
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null)
  const [localClients, setLocalClients] = useState<Client[]>(clients)
  const completeClientNameRef = useRef<HTMLInputElement>(null)
  const temporaryClientNameRef = useRef<HTMLInputElement>(null)

  const [status, setStatus] = useState<string>('')
  const editForm = useForm<AppointmentFormInput>({
    resolver: zodResolver(appointmentFormSchema, undefined, { raw: true }),
    defaultValues: {
      useTemporaryClient: false,
      clientId: '',
      temporaryClientName: '',
      temporaryClientNotes: '',
      staffId: '',
      serviceId: '',
      date: '',
      startTime: '',
      durationMinutes: 45,
      endTime: '',
      notes: '',
    },
  })
  const {
    handleSubmit: handleEditSubmit,
    register: registerEdit,
    reset: resetEditForm,
    setError: setEditError,
    setValue: setEditValue,
    watch: watchEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = editForm
  const clientId = watchEdit('clientId') ?? ''
  const useTemporaryClient = Boolean(watchEdit('useTemporaryClient'))
  const temporaryClientName = watchEdit('temporaryClientName') ?? ''
  const staffId = watchEdit('staffId') ?? ''
  const serviceId = watchEdit('serviceId') ?? ''
  const date = watchEdit('date') ?? ''
  const startTime = watchEdit('startTime') ?? ''
  const durationMinutes = Number(watchEdit('durationMinutes')) || 45
  const endTime = watchEdit('endTime') ?? ''

  const completeForm = useForm<CompletePlaceholderClientInput>({
    resolver: zodResolver(completePlaceholderClientSchema),
    defaultValues: {
      name: '',
      phone: '',
      notes: '',
      reassignToExistingClientId: undefined,
    },
  })
  const {
    clearErrors: clearCompleteErrors,
    handleSubmit: handleCompleteSubmit,
    register: registerComplete,
    reset: resetCompleteForm,
    setError: setCompleteFormError,
    setValue: setCompleteValue,
    watch: watchComplete,
    formState: { errors: completeErrors },
  } = completeForm
  const completeClientName = watchComplete('name') ?? ''
  const completeClientPhone = watchComplete('phone') ?? ''

  const staffRoleOnly = useMemo(
    () => staff.filter((m) => m.role === 'staff'),
    [staff]
  )

  useEffect(() => {
    setLocalClients(clients)
  }, [clients])

  useEffect(() => {
    setIsEditing(false)
    setEditingAppointmentId(null)
    setShowDeleteConfirm(false)
    setShowCompleteClientDrawer(false)
    setCompleteClientLoading(false)
    setDuplicateClient(null)
    setError('')
    setStatusAction(null)
    resetEditForm()
    resetCompleteForm()
  }, [appointment?.id])

  const applyDuration = (mins: number) => {
    const clamped = Math.min(
      APPOINTMENT_DURATION_BOUNDS.max,
      Math.max(APPOINTMENT_DURATION_BOUNDS.min, mins)
    )
    setEditValue('durationMinutes', clamped, { shouldDirty: true })
    setEditValue('endTime', endTimeFromDuration(startTime, clamped), { shouldDirty: true })
  }

  const applyEndTime = (et: string) => {
    setEditValue('endTime', et, { shouldDirty: true })
    try {
      const d = durationMinutesFromRange(startTime, et)
      if (d > 0) setEditValue('durationMinutes', d, { shouldDirty: true })
    } catch {
      /* ignore */
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setIsEditing(false)
      setEditingAppointmentId(null)
      setShowDeleteConfirm(false)
      setShowCompleteClientDrawer(false)
      setCompleteClientLoading(false)
      setDuplicateClient(null)
      setError('')
      setStatusAction(null)
      resetEditForm()
      resetCompleteForm()
    } else {
      setLocalClients(clients)
    }
    onOpenChange(isOpen)
  }

  const handleClientCreated = (newClient: Client) => {
    setLocalClients((prev) => [newClient, ...prev])
    onClientsChanged?.()
  }

  const startEditing = () => {
    if (!appointment || readOnly) return
    setLocalClients(
      appointment.client.isPlaceholder && !clients.some((client) => client.id === appointment.client.id)
        ? [appointment.client, ...clients]
        : clients
    )
    resetEditForm({
      useTemporaryClient: appointment.client.isPlaceholder,
      temporaryClientName: appointment.client.isPlaceholder ? appointment.client.name : '',
      temporaryClientNotes: appointment.client.isPlaceholder ? appointment.client.notes ?? '' : '',
      clientId: appointment.client.isPlaceholder ? '' : appointment.clientId,
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      durationMinutes: durationMinutesFromRange(appointment.startTime, appointment.endTime),
      notes: appointment.notes || '',
    })
    setStatus(appointment.status)
    setIsEditing(true)
    setEditingAppointmentId(appointment.id)
  }

  useEffect(() => {
    if (showCompleteClientDrawer) {
      requestAnimationFrame(() => completeClientNameRef.current?.focus())
    }
  }, [showCompleteClientDrawer])

  useEffect(() => {
    if (isEditing && useTemporaryClient) {
      requestAnimationFrame(() => temporaryClientNameRef.current?.focus())
    }
  }, [isEditing, useTemporaryClient])

  const openCompleteClientDrawer = () => {
    if (!appointment?.client.isPlaceholder) return
    resetCompleteForm({
      name: appointment.client.name,
      phone: '',
      notes: appointment.client.notes ?? '',
      reassignToExistingClientId: undefined,
    })
    setDuplicateClient(null)
    setShowCompleteClientDrawer(true)
  }

  const submitCompleteClient = handleCompleteSubmit(async (values) => {
    if (!appointment) return

    setCompleteClientLoading(true)
    clearCompleteErrors('root')

    try {
      let updated: AppointmentWithDetails
      if (dataClient) {
        updated = await dataClient.appointments.completePlaceholderClient(appointment.id, {
          ...values,
          notes: values.notes ?? undefined,
        })
        void dataClient.sync.processPending()
      } else {
        const res = await fetch(`/api/appointments/${appointment.id}/complete-client`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...values, notes: values.notes ?? undefined }),
        })

        const data = await res.json()
        if (!res.ok) {
          setCompleteFormError('root', { message: data.error || 'تکمیل اطلاعات مشتری انجام نشد' })
          setDuplicateClient(data.existingClient ?? null)
          return
        }
        updated = data.appointment as AppointmentWithDetails
      }

      setShowCompleteClientDrawer(false)
      setDuplicateClient(null)
      onClientsChanged?.()
      onSuccess({ type: 'updated', appointment: updated })
    } catch (err) {
      if (err instanceof DataClientHttpError) {
        setCompleteFormError('root', { message: err.message })
        const body = err.body as { existingClient?: Client } | null
        setDuplicateClient(body?.existingClient ?? null)
      } else {
        setCompleteFormError('root', { message: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.' })
      }
    } finally {
      setCompleteClientLoading(false)
    }
  })

  const handleEditServiceChange = (id: string) => {
    setEditValue('serviceId', id, { shouldDirty: true, shouldValidate: true })
    const svc = services.find((s) => s.id === id)
    if (svc) applyDuration(svc.duration)

    const eligibleAll = eligibleStaffForService(staff, id)
    const eligibleStaffMembers = eligibleStaffForService(staffRoleOnly, id)
    if (eligibleStaffMembers.length === 1) {
      setEditValue('staffId', eligibleStaffMembers[0].id, { shouldDirty: true, shouldValidate: true })
    } else if (!eligibleAll.some((m) => m.id === staffId)) {
      setEditValue('staffId', '', { shouldDirty: true, shouldValidate: true })
    }
  }

  const handleEditStaffChange = (id: string) => {
    setEditValue('staffId', id, { shouldDirty: true, shouldValidate: true })
    const member = staffRoleOnly.find((s) => s.id === id)
    if (!member) return

    const eligible = eligibleServicesForStaff(member, services)
    const current = services.find((s) => s.id === serviceId)
    const serviceStillOk =
      !!current && eligible.some((s) => s.id === serviceId)

    if (!serviceStillOk) {
      const explicitList =
        member.serviceIds != null && member.serviceIds.length > 0
      const auto = autoPickServiceForStaff(eligible, {
        staffHasExplicitServiceList: explicitList,
      })
      if (auto) {
        setEditValue('serviceId', auto.id, { shouldDirty: true, shouldValidate: true })
        applyDuration(auto.duration)
      } else {
        setEditValue('serviceId', '', { shouldDirty: true, shouldValidate: true })
      }
    }
  }

  const handleUpdate = handleEditSubmit(async (values) => {
    if (!appointment) return
    setError('')

    const localCheck = validateAppointmentWindow(values.startTime, values.endTime)
    if (!localCheck.ok) {
      setEditError('root', { message: localCheck.error })
      return
    }

    setLoading(true)
    try {
      const payload = appointmentFormSchema.parse(values)
      if (dataClient) {
        const result = await dataClient.appointments.update(appointment.id, {
          ...payload,
          status: status as AppointmentWithDetails['status'],
        })
        void dataClient.sync.processPending()
        onSuccess(
          result.type === 'deleted'
            ? { type: 'deleted', id: result.id }
            : { type: 'updated', appointment: result.appointment }
        )
        return
      }

      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          status,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setEditError('root', { message: data.error || 'به‌روزرسانی نوبت انجام نشد' })
        setLoading(false)
        return
      }

      if (typeof data.removedAppointmentId === 'string') {
        onSuccess({ type: 'deleted', id: data.removedAppointmentId })
        return
      }

      if (!data.appointment) {
        setEditError('root', { message: 'پاسخ به‌روزرسانی کامل نبود' })
        setLoading(false)
        return
      }

      onSuccess({ type: 'updated', appointment: data.appointment })
    } catch (err) {
      setEditError('root', {
        message:
          err instanceof DataClientHttpError
            ? err.message
            : 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
      })
    } finally {
      setLoading(false)
    }
  })

  const handleDelete = async () => {
    if (!appointment) return
    setError('')
    setLoading(true)

    try {
      if (dataClient) {
        await dataClient.appointments.remove(appointment.id)
        void dataClient.sync.processPending()
        onSuccess({ type: 'deleted', id: appointment.id })
        return
      }

      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'حذف نوبت انجام نشد')
        setLoading(false)
        return
      }

      onSuccess({ type: 'deleted', id: appointment.id })
    } catch (err) {
      setError(
        err instanceof DataClientHttpError
          ? err.message
          : 'خطایی رخ داد. لطفاً دوباره تلاش کنید.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!appointment) return
    setError('')
    const nextStatus = newStatus as AppointmentWithDetails['status']
    setStatusAction({
      status: nextStatus,
      mode: 'saving',
      message: 'در حال ثبت وضعیت...',
    })
    setLoading(true)

    try {
      if (dataClient) {
        const result = await dataClient.appointments.updateStatus(
          appointment.id,
          nextStatus
        )
        void dataClient.sync.processPending()
        setStatusAction({
          status: nextStatus,
          mode: isOnline ? 'saved' : 'queued',
          message:
            result.type === 'deleted'
              ? isOnline
                ? 'رزرو موقت لغو و حذف شد.'
                : 'لغو رزرو موقت آفلاین ثبت شد و بعدا همگام می‌شود.'
              : isOnline
                ? 'وضعیت نوبت ثبت شد.'
                : 'وضعیت نوبت آفلاین ثبت شد و بعدا همگام می‌شود.',
        })
        onSuccess(
          result.type === 'deleted'
            ? { type: 'deleted', id: result.id }
            : { type: 'updated', appointment: result.appointment }
        )
        return
      }

      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'تغییر وضعیت انجام نشد')
        setStatusAction(null)
        setLoading(false)
        return
      }

      if (typeof data.removedAppointmentId === 'string') {
        setStatusAction({
          status: nextStatus,
          mode: 'saved',
          message: 'رزرو موقت لغو و حذف شد.',
        })
        onSuccess({ type: 'deleted', id: data.removedAppointmentId })
        return
      }

      if (!data.appointment) {
        setError('پاسخ تغییر وضعیت کامل نبود')
        setStatusAction(null)
        setLoading(false)
        return
      }

      setStatusAction({
        status: nextStatus,
        mode: 'saved',
        message: 'وضعیت نوبت ثبت شد.',
      })
      onSuccess({ type: 'updated', appointment: data.appointment })
    } catch (err) {
      setError(
        err instanceof DataClientHttpError
          ? err.message
          : 'خطایی رخ داد. لطفاً دوباره تلاش کنید.'
      )
      setStatusAction(null)
    } finally {
      setLoading(false)
    }
  }

  if (!appointment) return null

  const statusInfo = APPOINTMENT_STATUS[appointment.status]
  const isEditingCurrentAppointment = isEditing && editingAppointmentId === appointment.id
  const editableServices = services.filter(
    (service) => service.active || service.id === serviceId,
  )

  return (
    <Drawer open={!!appointment} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            {isEditingCurrentAppointment ? 'ویرایش نوبت' : appointment.client.name}
          </DrawerTitle>
          <DrawerDescription>
            {isEditingCurrentAppointment
              ? 'جزئیات نوبت را ویرایش کنید. نوبت‌های هم‌زمان فقط با پرسنل و مشتری متفاوت نسبت به نوبت‌های هم‌پوشان مجاز است.'
              : formatCompactServiceLabel(appointment.service)}
          </DrawerDescription>
        </DrawerHeader>

        {isEditingCurrentAppointment ? (
          <form onSubmit={handleUpdate} className="flex flex-col gap-4 overflow-auto px-4">
            <FieldGroup>
              <Field>
                <FieldLabel>مشتری</FieldLabel>
                <div className="space-y-3">
                  <label
                    htmlFor="edit-temporary-client-mode"
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
                  >
                    <Checkbox
                      id="edit-temporary-client-mode"
                      checked={useTemporaryClient}
                      onCheckedChange={(checked) => {
                        const enabled = checked === true
                        setEditValue('useTemporaryClient', enabled, { shouldDirty: true, shouldValidate: true })
                        setError('')
                        if (enabled) {
                          setEditValue('clientId', '', { shouldDirty: true })
                          setEditValue(
                            'temporaryClientName',
                            appointment.client.isPlaceholder ? appointment.client.name : '',
                            { shouldDirty: true },
                          )
                          setEditValue(
                            'temporaryClientNotes',
                            appointment.client.isPlaceholder ? appointment.client.notes ?? '' : '',
                            { shouldDirty: true },
                          )
                          return
                        }
                        setEditValue('temporaryClientName', '', { shouldDirty: true })
                        setEditValue('temporaryClientNotes', '', { shouldDirty: true })
                      }}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">بعداً اطلاعات مشتری را کامل می‌کنم</p>
                      <p className="text-xs text-muted-foreground">
                        در حالت موقت فقط یک نام نمایشی نگه می‌داریم و شماره تماس بعداً تکمیل می‌شود.
                      </p>
                    </div>
                  </label>

                  {useTemporaryClient ? (
                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <Field className="gap-2">
                        <FieldLabel htmlFor="edit-temporary-client-name">نام مشتری</FieldLabel>
                        <Input
                          id="edit-temporary-client-name"
                          ref={temporaryClientNameRef}
                          value={temporaryClientName}
                          onChange={(event) =>
                            setEditValue('temporaryClientName', event.target.value, {
                              shouldDirty: true,
                              shouldValidate: false,
                            })
                          }
                          placeholder="مثلاً دوستِ سارا"
                        />
                        {editErrors.temporaryClientName && (
                          <FieldError>{editErrors.temporaryClientName.message}</FieldError>
                        )}
                      </Field>

                      <Field className="gap-2">
                        <FieldLabel htmlFor="edit-temporary-client-notes">یادداشت (اختیاری)</FieldLabel>
                        <Input
                          id="edit-temporary-client-notes"
                          value={watchEdit('temporaryClientNotes') ?? ''}
                          onChange={(event) =>
                            setEditValue('temporaryClientNotes', event.target.value, {
                              shouldDirty: true,
                            })
                          }
                          placeholder="مثلاً شماره را بعداً می‌گیرم"
                        />
                      </Field>
                    </div>
                  ) : (
                    <ClientPicker
                      clients={localClients}
                      value={clientId}
                      onChange={(id) => setEditValue('clientId', id, { shouldDirty: true, shouldValidate: true })}
                      onClientCreated={handleClientCreated}
                    />
                  )}
                  {editErrors.clientId && <FieldError>{editErrors.clientId.message}</FieldError>}
                </div>
              </Field>

              <div className="flex min-w-0 flex-col gap-7">
                <Field>
                  <FieldLabel>پرسنل</FieldLabel>
                  <Select
                    value={staffId || undefined}
                    onValueChange={handleEditStaffChange}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="انتخاب پرسنل" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffRoleOnly.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>خدمت</FieldLabel>
                  <ServicePicker
                    services={editableServices}
                    value={serviceId || undefined}
                    onChange={handleEditServiceChange}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="edit-date">تاریخ</FieldLabel>
                  <JalaliDatePicker
                    id="edit-date"
                    value={date}
                    onChange={(value) => setEditValue('date', value, { shouldDirty: true, shouldValidate: true })}
                    required
                  />
                  {editErrors.date && <FieldError>{editErrors.date.message}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-time">شروع</FieldLabel>
                  <TimePicker
                    id="edit-time"
                    value={startTime}
                    onChange={(st) => {
                      setEditValue('startTime', st, { shouldDirty: true, shouldValidate: true })
                      setEditValue('endTime', endTimeFromDuration(st, durationMinutes), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }}
                    label="ساعت شروع"
                  />
                  {editErrors.startTime && <FieldError>{editErrors.startTime.message}</FieldError>}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="edit-duration">مدت (دقیقه)</FieldLabel>
                <Input
                  id="edit-duration"
                  type="text"
                  inputMode="numeric"
                  value={toPersianDigits(durationMinutes)}
                  onChange={(e) => {
                    const v = parseLocalizedInt(e.target.value, durationMinutes)
                    if (!Number.isFinite(v)) return
                    applyDuration(v)
                  }}
                  dir="rtl"
                  className="text-right tabular-nums"
                />
                {editErrors.durationMinutes && <FieldError>{editErrors.durationMinutes.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-end">پایان</FieldLabel>
                <TimePicker
                  id="edit-end"
                  value={endTime}
                  onChange={applyEndTime}
                  label="ساعت پایان"
                />
                {editErrors.endTime && <FieldError>{editErrors.endTime.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>وضعیت</FieldLabel>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(APPOINTMENT_STATUS).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-notes">توضیحات (اختیاری)</FieldLabel>
                <Input
                  id="edit-notes"
                  placeholder="یادداشت درباره این نوبت…"
                  {...registerEdit('notes')}
                />
              </Field>

              <FormRootError message={editErrors.root?.message ?? error} />
            </FieldGroup>
          </form>
        ) : (
          <div className="flex flex-col gap-4 overflow-auto px-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn('text-xs', statusInfo.color)}>
                {statusInfo.label}
              </Badge>
              {appointment.client.isPlaceholder ? (
                <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-800">
                  اطلاعات ناقص
                </Badge>
              ) : null}
              <span className="text-sm text-muted-foreground">{formatTomans(appointment.bookedServicePrice)}</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="h-4 w-4 shrink-0 rounded-sm" style={{ backgroundColor: appointment.service.color }} />
                <span>
                  {appointment.service.categoryName
                    ? `${appointment.service.categoryName} / ${appointment.bookedServiceName}`
                    : appointment.bookedServiceName}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{formatJalaliFullDate(appointment.date)}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span dir="ltr" className="text-right">
                  {formatPersianTime(format(parseISO(`2000-01-01T${appointment.startTime}`), 'HH:mm'))} —{' '}
                  {formatPersianTime(format(parseISO(`2000-01-01T${appointment.endTime}`), 'HH:mm'))}
                  <span className="text-muted-foreground mr-1">
                    (
                    {toPersianDigits(durationMinutesFromRange(appointment.startTime, appointment.endTime))}{' '}
                    دقیقه)
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>با {appointment.staff.name}</span>
              </div>

              {appointment.client.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${appointment.client.phone}`} className="text-primary hover:underline">
                    {displayPhone(appointment.client.phone)}
                  </a>
                </div>
              )}

              {appointment.notes && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="text-muted-foreground">{appointment.notes}</p>
                </div>
              )}
            </div>

            {canChangeStatus && appointment.status === 'scheduled' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-10 touch-manipulation"
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={loading}
                >
                  {statusAction?.mode === 'saving' && statusAction.status === 'confirmed' && (
                    <Spinner className="ml-2 size-3.5" />
                  )}
                  تایید نوبت
                </Button>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 touch-manipulation"
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={loading}
                  >
                    {statusAction?.mode === 'saving' && statusAction.status === 'cancelled' && (
                      <Spinner className="ml-2 size-3.5" />
                    )}
                    لغو
                  </Button>
                )}
              </div>
            )}

            {canChangeStatus && appointment.status === 'confirmed' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-10 touch-manipulation"
                  onClick={() => handleStatusChange('completed')}
                  disabled={loading}
                >
                  {statusAction?.mode === 'saving' && statusAction.status === 'completed' && (
                    <Spinner className="ml-2 size-3.5" />
                  )}
                  انجام شد
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-10 touch-manipulation"
                  onClick={() => handleStatusChange('no-show')}
                  disabled={loading}
                >
                  {statusAction?.mode === 'saving' && statusAction.status === 'no-show' && (
                    <Spinner className="ml-2 size-3.5" />
                  )}
                  غیبت
                </Button>
              </div>
            )}

            {statusAction && statusAction.mode !== 'saving' && (
              <p
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs',
                  statusAction.mode === 'queued'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'
                )}
              >
                {statusAction.message}
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {appointment.client.isPlaceholder && !readOnly ? (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 text-sm text-amber-950">
                <p className="font-medium">اطلاعات این مشتری هنوز کامل نشده است.</p>
                <p className="mt-1 text-xs text-amber-800">
                  شماره تماس و مشخصات نهایی را ثبت کنید تا این نوبت مثل یک مشتری عادی ادامه پیدا کند.
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  variant="outline"
                  onClick={openCompleteClientDrawer}
                >
                  تکمیل اطلاعات مشتری
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <DrawerFooter>
          {readOnly ? (
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                بستن
              </Button>
            </DrawerClose>
          ) : isEditingCurrentAppointment ? (
            <>
              <Button
                onClick={handleUpdate}
                disabled={
                  loading ||
                  isEditSubmitting ||
                  (useTemporaryClient ? !temporaryClientName.trim() : !clientId)
                }
              >
                {(loading || isEditSubmitting) && <Spinner className="mr-2" />}
                {loading || isEditSubmitting ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setEditingAppointmentId(null)
                }}
              >
                انصراف
              </Button>
            </>
          ) : showDeleteConfirm ? (
            <>
              <p className="text-sm text-center text-muted-foreground mb-2">
                آیا از حذف این نوبت مطمئن هستید؟
              </p>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading && <Spinner className="mr-2" />}
                بله، حذف شود
              </Button>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                انصراف
              </Button>
            </>
          ) : (
            <>
              <Button onClick={startEditing} className="touch-manipulation">
                ویرایش نوبت
              </Button>
              <div className="flex gap-2">
                <DrawerClose asChild>
                  <Button variant="outline" className="flex-1">
                    بستن
                  </Button>
                </DrawerClose>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>

      <DrawerNested open={showCompleteClientDrawer} onOpenChange={setShowCompleteClientDrawer}>
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92lvh]">
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
                    setCompleteValue('name', event.target.value, { shouldDirty: true })
                  }
                  placeholder="نام کامل مشتری"
                />
                {completeErrors.name ? <FieldError>{completeErrors.name.message}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="complete-client-phone">شماره تماس</FieldLabel>
                <Input
                  id="complete-client-phone"
                  type="tel"
                  value={displayPhone(completeClientPhone, '')}
                  onChange={(e) => setCompleteValue('phone', e.target.value)}
                  placeholder="۰۹۱۲…"
                  dir="ltr"
                  className="text-left tabular-nums"
                />
                {completeErrors.phone ? <FieldError>{completeErrors.phone.message}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="complete-client-notes">یادداشت (اختیاری)</FieldLabel>
                <Input
                  id="complete-client-notes"
                  value={watchComplete('notes') ?? ''}
                  onChange={(event) =>
                    setCompleteValue('notes', event.target.value, { shouldDirty: true })
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
                    می‌توانید این نوبت را به همان مشتری موجود وصل کنید تا سابقه‌ها یکی بماند.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setCompleteValue('reassignToExistingClientId', duplicateClient.id)
                      void submitCompleteClient()
                    }}
                    disabled={completeClientLoading}
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
              onClick={() => {
                setCompleteValue('reassignToExistingClientId', undefined)
                void submitCompleteClient()
              }}
              disabled={
                completeClientLoading ||
                !completeClientName.trim() ||
                !completeClientPhone.trim()
              }
            >
              {completeClientLoading ? 'در حال ذخیره…' : 'ثبت اطلاعات'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">بستن</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </DrawerNested>
    </Drawer>
  )
}
