import { useEffect, useMemo, useRef, useState } from 'react'
import { useManagerMutation } from '#/lib/use-manager-mutation'
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
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
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
import { cn } from '@repo/ui/utils'
import {
  Phone,
  Clock,
  Trash2,
  Scissors,
  ChevronLeft,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import {
  ClientAvatar,
  clientAccent,
  isVip,
} from '#/components/clients/client-visuals'
import {
  APPOINTMENT_DURATION_BOUNDS,
  durationMinutesFromRange,
  endTimeFromDuration,
  validateAppointmentWindow,
} from '@repo/salon-core/appointment-time'
import {
  appointmentFormSchema,
  completePlaceholderClientSchema,
} from '@repo/salon-core/forms/appointment'
import type {
  AppointmentFormInput,
  CompletePlaceholderClientInput,
} from '@repo/salon-core/forms/appointment'
import { ClientPicker } from '#/components/calendar/client-picker'
import { useManagerDataClient } from '#/lib/manager-data-client'
import { useServiceAddons } from '#/lib/use-service-addons'
import { ServicePicker } from '#/components/services/service-picker'
import { StaffPicker } from '#/components/calendar/staff-picker'
import { DataClientHttpError } from '@repo/data-client'
import { useNetworkStatus } from '#/lib/network-status'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { TimePicker } from '@repo/ui/time-picker'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import {
  formatPersianTime,
  parseLocalizedInt,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  STATUS_CHANGE_SEGMENTS,
  appointmentEditFormDefaults,
  buildAppointmentDetailEditViewModel,
  clientsForAppointmentEdit,
  formatTomans,
  isHistoricalAddon,
  statusChangeFeedbackMessage,
  tomansFormatter,
} from '#/lib/appointment-detail-view-model'

type StatusActionState = {
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'queued'
  message: string
} | null

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

export type AppointmentDetailChange =
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
  const [statusAction, setStatusAction] = useState<StatusActionState>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    string | null
  >(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCompleteClientDrawer, setShowCompleteClientDrawer] =
    useState(false)
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
      addonIds: [],
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
  const date = watchEdit('date')
  const startTime = watchEdit('startTime')
  const durationMinutes = Number(watchEdit('durationMinutes')) || 45
  const endTime = watchEdit('endTime')
  const addonIds = watchEdit('addonIds') ?? []

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
    reset: resetCompleteForm,
    setError: setCompleteFormError,
    setValue: setCompleteValue,
    watch: watchComplete,
    formState: { errors: completeErrors },
  } = completeForm
  const completeClientName = watchComplete('name')
  const completeClientPhone = watchComplete('phone')

  const isEditingCurrentAppointment = Boolean(
    appointment && isEditing && editingAppointmentId === appointment.id,
  )
  const { data: availableAddons = [], isPending: addonsLoading } =
    useServiceAddons(serviceId, isEditingCurrentAppointment && !!serviceId)
  const editViewModel = useMemo(
    () =>
      buildAppointmentDetailEditViewModel({
        staff,
        services,
        serviceId,
        availableAddons,
        appointment,
        addonIds,
        durationMinutes,
      }),
    [
      staff,
      services,
      serviceId,
      availableAddons,
      appointment,
      addonIds,
      durationMinutes,
    ],
  )
  const {
    staffRoleOnly,
    selectedEditService,
    addonOptions,
    previewDuration,
    previewPrice,
    editableServices,
  } = editViewModel

  useEffect(() => {
    setLocalClients(clients)
  }, [clients])

  useEffect(() => {
    setIsEditing(false)
    setEditingAppointmentId(null)
    setShowDeleteConfirm(false)
    setShowCompleteClientDrawer(false)
    setDuplicateClient(null)
    setStatusAction(null)
    resetEditForm()
    resetCompleteForm()
  }, [appointment?.id, resetEditForm, resetCompleteForm])

  const applyDuration = (mins: number) => {
    const clamped = Math.min(
      APPOINTMENT_DURATION_BOUNDS.max,
      Math.max(APPOINTMENT_DURATION_BOUNDS.min, mins),
    )
    setEditValue('durationMinutes', clamped, { shouldDirty: true })
    setEditValue('endTime', endTimeFromDuration(startTime, clamped), {
      shouldDirty: true,
    })
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

  const applyCatalogDuration = (
    baseService: Service | undefined,
    addons: ServiceAddon[],
  ) => {
    applyDuration(
      (baseService?.duration ?? 45) +
        addons.reduce((sum, addon) => sum + addon.durationDelta, 0),
    )
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setIsEditing(false)
      setEditingAppointmentId(null)
      setShowDeleteConfirm(false)
      setShowCompleteClientDrawer(false)
      setDuplicateClient(null)
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
    setLocalClients(clientsForAppointmentEdit(appointment, clients))
    resetEditForm(appointmentEditFormDefaults(appointment))
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

  const handleEditServiceChange = (id: string) => {
    setEditValue('serviceId', id, { shouldDirty: true, shouldValidate: true })
    setEditValue('addonIds', [], { shouldDirty: true, shouldValidate: true })
    const svc = services.find((s) => s.id === id)
    if (svc) applyDuration(svc.duration)

    const eligibleStaffMembers = eligibleStaffForService(staffRoleOnly, id)
    const currentStillEligible =
      !!staffId && eligibleStaffMembers.some((m) => m.id === staffId)
    if (currentStillEligible) return
    if (eligibleStaffMembers.length > 0) {
      setEditValue('staffId', eligibleStaffMembers[0].id, {
        shouldDirty: true,
        shouldValidate: true,
      })
    } else {
      setEditValue('staffId', '', { shouldDirty: true, shouldValidate: true })
    }
  }

  const toggleEditAddon = (addon: ServiceAddon) => {
    const nextIds = addonIds.includes(addon.id)
      ? addonIds.filter((id) => id !== addon.id)
      : [...addonIds, addon.id]
    const nextAddons = addonOptions.filter((item) => nextIds.includes(item.id))
    setEditValue('addonIds', nextIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
    applyCatalogDuration(selectedEditService, nextAddons)
  }

  const handleEditStaffChange = (id: string) => {
    setEditValue('staffId', id, { shouldDirty: true, shouldValidate: true })
    const member = staffRoleOnly.find((s) => s.id === id)
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
        setEditValue('serviceId', auto.id, {
          shouldDirty: true,
          shouldValidate: true,
        })
        applyDuration(auto.duration)
      } else {
        setEditValue('serviceId', '', {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    }
  }

  const updateAppointment = useManagerMutation(
    async (
      dc,
      {
        appointmentId,
        values,
        nextStatus,
      }: {
        appointmentId: string
        values: AppointmentFormInput
        nextStatus: AppointmentWithDetails['status']
      },
    ): Promise<AppointmentDetailChange> => {
      const payload = appointmentFormSchema.parse(values)
      const r = await dc.appointments.update(appointmentId, {
        ...payload,
        status: nextStatus,
      })
      return r.type === 'deleted'
        ? { type: 'deleted', id: r.id }
        : { type: 'updated', appointment: r.appointment }
    },
  )

  const deleteAppointment = useManagerMutation(
    async (dc, appointmentId: string) => {
      await dc.appointments.remove(appointmentId)
    },
  )

  const completePlaceholderClientMutation = useManagerMutation(
    async (dc, values: CompletePlaceholderClientInput) => {
      if (!appointment) {
        throw new DataClientHttpError('نوبت یافت نشد', 0, null)
      }
      const payload = { ...values, notes: values.notes ?? undefined }
      return dc.appointments.completePlaceholderClient(appointment.id, payload)
    },
    {
      meta: {
        skipErrorToast: true,
        errorMessage: 'ثبت اطلاعات مشتری انجام نشد',
      },
    },
  )

  type StatusChangeResult =
    | { type: 'deleted'; id: string }
    | { type: 'updated'; appointment: AppointmentWithDetails }

  const updateAppointmentStatus = useManagerMutation(
    async (
      dc,
      {
        appointmentId,
        nextStatus,
      }: {
        appointmentId: string
        nextStatus: AppointmentWithDetails['status']
      },
    ): Promise<StatusChangeResult> => {
      const result = await dc.appointments.updateStatus(
        appointmentId,
        nextStatus,
      )
      return result.type === 'deleted'
        ? { type: 'deleted', id: result.id }
        : { type: 'updated', appointment: result.appointment }
    },
    { meta: { skipSuccessToast: true } },
  )

  const isMutating =
    updateAppointment.isPending ||
    deleteAppointment.isPending ||
    updateAppointmentStatus.isPending

  const submitCompleteClient = handleCompleteSubmit(async (values) => {
    if (!appointment) return

    clearCompleteErrors('root')
    setDuplicateClient(null)

    try {
      const updated =
        await completePlaceholderClientMutation.mutateAsync(values)
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
        setCompleteFormError('root', {
          message: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
        })
      }
    }
  })

  const handleUpdate = handleEditSubmit(async (values) => {
    if (!appointment) return

    const localCheck = validateAppointmentWindow(
      values.startTime,
      values.endTime,
    )
    if (!localCheck.ok) {
      setEditError('root', { message: localCheck.error })
      return
    }

    try {
      const change = await updateAppointment.mutateAsync({
        appointmentId: appointment.id,
        values,
        nextStatus: status as AppointmentWithDetails['status'],
      })
      onSuccess(change)
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const handleDelete = async () => {
    if (!appointment) return

    try {
      await deleteAppointment.mutateAsync(appointment.id)
      onSuccess({ type: 'deleted', id: appointment.id })
    } catch {
      // Toast handled by mutation cache.
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!appointment) return
    const nextStatus = newStatus as AppointmentWithDetails['status']
    setStatusAction({
      status: nextStatus,
      mode: 'saving',
      message: 'در حال ثبت وضعیت...',
    })

    try {
      const result = await updateAppointmentStatus.mutateAsync({
        appointmentId: appointment.id,
        nextStatus,
      })

      setStatusAction({
        status: nextStatus,
        mode: dataClient && !isOnline ? 'queued' : 'saved',
        message: statusChangeFeedbackMessage({
          hasDataClient: Boolean(dataClient),
          isOnline,
          changeType: result.type,
        }),
      })
      onSuccess(
        result.type === 'deleted'
          ? { type: 'deleted', id: result.id }
          : { type: 'updated', appointment: result.appointment },
      )
    } catch {
      setStatusAction(null)
      // Toast handled by mutation cache.
    }
  }

  if (!appointment) return null

  return (
    <Drawer open={!!appointment} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {isEditingCurrentAppointment ? 'ویرایش نوبت' : 'جزئیات نوبت'}
          </DrawerTitle>
          <DrawerDescription>
            {isEditingCurrentAppointment
              ? 'جزئیات نوبت را ویرایش کنید. نوبت‌های هم‌زمان فقط با پرسنل و مشتری متفاوت نسبت به نوبت‌های هم‌پوشان مجاز است.'
              : formatJalaliFullDate(appointment.date)}
          </DrawerDescription>
        </DrawerHeader>

        {isEditingCurrentAppointment ? (
          <form
            onSubmit={handleUpdate}
            className="flex flex-col gap-4 overflow-auto px-4"
          >
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
                        setEditValue('useTemporaryClient', enabled, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                        if (enabled) {
                          setEditValue('clientId', '', { shouldDirty: true })
                          setEditValue(
                            'temporaryClientName',
                            appointment.client.isPlaceholder
                              ? appointment.client.name
                              : '',
                            { shouldDirty: true },
                          )
                          setEditValue(
                            'temporaryClientNotes',
                            appointment.client.isPlaceholder
                              ? (appointment.client.notes ?? '')
                              : '',
                            { shouldDirty: true },
                          )
                          return
                        }
                        setEditValue('temporaryClientName', '', {
                          shouldDirty: true,
                        })
                        setEditValue('temporaryClientNotes', '', {
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
                        در حالت موقت فقط یک نام نمایشی نگه می‌داریم و شماره تماس
                        بعداً تکمیل می‌شود.
                      </p>
                    </div>
                  </label>

                  {useTemporaryClient ? (
                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <Field className="gap-2">
                        <FieldLabel htmlFor="edit-temporary-client-name">
                          نام مشتری
                        </FieldLabel>
                        <Input
                          id="edit-temporary-client-name"
                          ref={temporaryClientNameRef}
                          value={temporaryClientName}
                          onChange={(event) =>
                            setEditValue(
                              'temporaryClientName',
                              event.target.value,
                              {
                                shouldDirty: true,
                                shouldValidate: false,
                              },
                            )
                          }
                          placeholder="مثلاً دوستِ سارا"
                        />
                        {editErrors.temporaryClientName && (
                          <FieldError>
                            {editErrors.temporaryClientName.message}
                          </FieldError>
                        )}
                      </Field>

                      <Field className="gap-2">
                        <FieldLabel htmlFor="edit-temporary-client-notes">
                          یادداشت (اختیاری)
                        </FieldLabel>
                        <Input
                          id="edit-temporary-client-notes"
                          value={watchEdit('temporaryClientNotes') ?? ''}
                          onChange={(event) =>
                            setEditValue(
                              'temporaryClientNotes',
                              event.target.value,
                              {
                                shouldDirty: true,
                              },
                            )
                          }
                          placeholder="مثلاً شماره را بعداً می‌گیرم"
                        />
                      </Field>
                    </div>
                  ) : (
                    <ClientPicker
                      clients={localClients}
                      value={clientId}
                      onChange={(id) =>
                        setEditValue('clientId', id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      onClientCreated={handleClientCreated}
                    />
                  )}
                  {editErrors.clientId && (
                    <FieldError>{editErrors.clientId.message}</FieldError>
                  )}
                </div>
              </Field>

              <div className="flex min-w-0 flex-col gap-7">
                <Field>
                  <FieldLabel>پرسنل</FieldLabel>
                  <StaffPicker
                    staff={staffRoleOnly}
                    value={staffId || undefined}
                    onChange={handleEditStaffChange}
                    getStatus={(member) => {
                      const serviceMismatch =
                        !!serviceId &&
                        !eligibleStaffForService([member], serviceId).length
                      if (serviceMismatch)
                        return {
                          disabled: true,
                          reason: 'این خدمت را انجام نمی‌دهد',
                        }
                      return undefined
                    }}
                  />
                </Field>

                <Field>
                  <FieldLabel>خدمت</FieldLabel>
                  <ServicePicker
                    services={editableServices}
                    value={serviceId || undefined}
                    onChange={handleEditServiceChange}
                  />
                </Field>

                {selectedEditService ? (
                  <Field>
                    <FieldLabel>افزودنی‌ها</FieldLabel>
                    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                      {addonsLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Spinner className="size-3.5" />
                          در حال دریافت افزودنی‌ها...
                        </div>
                      ) : addonOptions.length > 0 ? (
                        addonOptions.map((addon) => (
                          <label
                            key={addon.id}
                            className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                          >
                            <Checkbox
                              checked={addonIds.includes(addon.id)}
                              onCheckedChange={() => toggleEditAddon(addon)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {addon.name}
                                {isHistoricalAddon(addon.id, availableAddons) ? (
                                  <span className="mr-2 text-xs font-normal text-muted-foreground">
                                    تاریخی
                                  </span>
                                ) : null}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                +{toPersianDigits(addon.durationDelta)} دقیقه ·
                                +{tomansFormatter.format(addon.priceDelta)}{' '}
                                تومان
                              </span>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          برای این خدمت افزودنی فعالی تعریف نشده است.
                        </p>
                      )}
                      <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
                        جمع پیش‌نمایش: {toPersianDigits(previewDuration)} دقیقه
                        · {formatTomans(previewPrice)}
                      </div>
                    </div>
                  </Field>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="edit-date">تاریخ</FieldLabel>
                  <JalaliDatePicker
                    id="edit-date"
                    value={date}
                    onChange={(value) =>
                      setEditValue('date', value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    required
                  />
                  {editErrors.date && (
                    <FieldError>{editErrors.date.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-time">شروع</FieldLabel>
                  <TimePicker
                    id="edit-time"
                    value={startTime}
                    onChange={(st) => {
                      setEditValue('startTime', st, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      setEditValue(
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
                  {editErrors.startTime && (
                    <FieldError>{editErrors.startTime.message}</FieldError>
                  )}
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
                {editErrors.durationMinutes && (
                  <FieldError>{editErrors.durationMinutes.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-end">پایان</FieldLabel>
                <TimePicker
                  id="edit-end"
                  value={endTime}
                  onChange={applyEndTime}
                  label="ساعت پایان"
                />
                {editErrors.endTime && (
                  <FieldError>{editErrors.endTime.message}</FieldError>
                )}
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

              <FormRootError message={editErrors.root?.message} />
            </FieldGroup>
          </form>
        ) : (
          <div className="flex flex-col gap-3 overflow-auto px-5 py-4">
            <div className="flex items-center gap-3 rounded-2xl bg-blush-soft p-3.5">
              <ClientAvatar
                name={appointment.client.name}
                accent={clientAccent(appointment.client)}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-bold text-foreground">
                    {appointment.client.name}
                  </span>
                  {isVip(appointment.client) ? (
                    <Badge variant="rose">VIP</Badge>
                  ) : null}
                  {appointment.client.isPlaceholder ? (
                    <Badge variant="amber">اطلاعات ناقص</Badge>
                  ) : null}
                </div>
                {appointment.client.phone ? (
                  <div
                    dir="ltr"
                    className="mt-0.5 text-right text-[13px] text-muted-foreground tabular-nums"
                  >
                    {displayPhone(appointment.client.phone)}
                  </div>
                ) : null}
              </div>
              {appointment.client.phone ? (
                <a
                  href={`tel:${appointment.client.phone}`}
                  aria-label="تماس"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary transition-colors hover:bg-card/80"
                >
                  <Phone className="size-4" />
                </a>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-blush-soft p-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <span>ساعت</span>
                  <Clock className="size-3.5" />
                </div>
                <div
                  dir="ltr"
                  className="mt-1 text-xl font-extrabold text-foreground tabular-nums"
                >
                  {formatPersianTime(appointment.startTime)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {toPersianDigits(
                    durationMinutesFromRange(
                      appointment.startTime,
                      appointment.endTime,
                    ),
                  )}{' '}
                  دقیقه
                </div>
              </div>
              <div className="rounded-2xl bg-blush-soft p-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <span>مبلغ</span>
                  <Wallet className="size-3.5" />
                </div>
                <div className="mt-1 text-xl font-extrabold text-primary tabular-nums">
                  {toPersianDigits(
                    Math.round(appointment.bookedTotalPrice / 1000),
                  )}{' '}
                  هـ
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  تومان
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={startEditing}
              disabled={readOnly}
              className="flex items-center gap-3 rounded-2xl bg-blush-soft p-3.5 text-right transition-colors enabled:hover:bg-secondary disabled:cursor-default"
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in oklch, ${appointment.service.color} 16%, transparent)`,
                }}
              >
                <Scissors
                  className="size-4"
                  style={{ color: appointment.service.color }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-foreground">
                  {appointment.bookedServiceName}
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {appointment.staff.name}
                  {appointment.bookedAddonCount > 0
                    ? ` · +${toPersianDigits(appointment.bookedAddonCount)} افزودنی`
                    : ''}
                </div>
              </div>
              {!readOnly ? (
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
              ) : null}
            </button>

            {appointment.bookedAddons && appointment.bookedAddons.length > 0 ? (
              <div className="rounded-2xl bg-blush-soft p-3.5 text-sm">
                <p className="mb-2 font-medium">افزودنی‌های ثبت‌شده</p>
                <div className="space-y-1.5">
                  {appointment.bookedAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                    >
                      <span>{addon.bookedAddonName}</span>
                      <span>
                        +{toPersianDigits(addon.bookedAddonDurationDelta)} دقیقه
                        · +{tomansFormatter.format(addon.bookedAddonPriceDelta)}{' '}
                        تومان
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {canChangeStatus ? (
              <div>
                <div className="mb-2 text-xs text-muted-foreground">وضعیت</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_CHANGE_SEGMENTS.map(({ key, label }) => {
                    const active = appointment.status === key
                    const saving =
                      statusAction?.mode === 'saving' &&
                      statusAction.status === key
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isMutating || active}
                        onClick={() => !active && handleStatusChange(key)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                          active
                            ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                            : 'border-transparent bg-blush-soft text-muted-foreground hover:text-foreground disabled:opacity-50',
                        )}
                      >
                        {saving ? <Spinner className="size-3.5" /> : null}
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {appointment.notes ? (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-soft p-3.5 text-[13px] text-amber-fg">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{appointment.notes}</p>
              </div>
            ) : null}

            {statusAction && statusAction.mode !== 'saving' ? (
              <p
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 text-xs',
                  statusAction.mode === 'queued'
                    ? 'bg-amber-soft text-amber-fg'
                    : 'bg-mint-soft text-mint-fg',
                )}
              >
                {statusAction.message}
              </p>
            ) : null}

            {appointment.client.isPlaceholder && !readOnly ? (
              <div className="rounded-2xl bg-amber-soft p-3.5 text-sm text-amber-fg">
                <p className="font-medium">
                  اطلاعات این مشتری هنوز کامل نشده است.
                </p>
                <p className="mt-1 text-xs opacity-90">
                  شماره تماس و مشخصات نهایی را ثبت کنید تا این نوبت مثل یک مشتری
                  عادی ادامه پیدا کند.
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
                  isMutating ||
                  isEditSubmitting ||
                  (useTemporaryClient ? !temporaryClientName.trim() : !clientId)
                }
              >
                {(isMutating || isEditSubmitting) && (
                  <Spinner className="mr-2" />
                )}
                {isMutating || isEditSubmitting
                  ? 'در حال ذخیره…'
                  : 'ذخیره تغییرات'}
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
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isMutating}
              >
                {isMutating && <Spinner className="mr-2" />}
                بله، حذف شود
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
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

      <DrawerNested
        open={showCompleteClientDrawer}
        onOpenChange={setShowCompleteClientDrawer}
      >
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
                <FieldLabel htmlFor="complete-client-name">
                  نام مشتری
                </FieldLabel>
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
                    می‌توانید این نوبت را به همان مشتری موجود وصل کنید تا
                    سابقه‌ها یکی بماند.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setCompleteValue(
                        'reassignToExistingClientId',
                        duplicateClient.id,
                      )
                      void submitCompleteClient()
                    }}
                    disabled={completePlaceholderClientMutation.isPending}
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
                completePlaceholderClientMutation.isPending ||
                !completeClientName.trim() ||
                !completeClientPhone.trim()
              }
            >
              {completePlaceholderClientMutation.isPending
                ? 'در حال ذخیره…'
                : 'ثبت اطلاعات'}
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
