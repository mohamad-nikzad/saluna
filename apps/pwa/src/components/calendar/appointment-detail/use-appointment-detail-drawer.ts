import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type {
  User,
  Service,
  ServiceAddon,
  Client,
  AppointmentWithDetails,
} from '@repo/salon-core/types'
import { endTimeFromDuration } from '@repo/salon-core/appointment-time'
import {
  appointmentFormSchema,
  completePlaceholderClientSchema,
} from '@repo/salon-core/forms/appointment'
import type {
  AppointmentFormInput,
  CompletePlaceholderClientInput,
} from '@repo/salon-core/forms/appointment'
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill'
import { useServiceAddons } from '#/lib/use-service-addons'
import {
  appointmentEditFormDefaults,
  buildAppointmentDetailEditViewModel,
  buildStatusActionState,
  clientsForAppointmentEdit,
  clampAppointmentDuration,
  durationFromEndTime,
  applyTemporaryClientModePatch,
  resolveIntakeAddonToggle,
  resolveIntakeServiceChange,
  resolveIntakeStaffChange,
  resolveTemporaryClientModeChange,
  validateAppointmentIntakeSubmit,
} from '#/lib/appointment-surface'
import type {
  AppointmentDetailChange,
  AppointmentStatusActionState,
} from '#/lib/appointment-surface'
import {
  duplicateClientFromError,
  isDuplicateClientError,
  useAppointmentIntakeMutations,
} from '#/lib/use-appointment-intake-mutations'
import { parseOptionalLocalizedInteger } from '#/components/localized-number-input'

type StatusActionState = AppointmentStatusActionState

export interface UseAppointmentDetailDrawerParams {
  appointment: AppointmentWithDetails | null
  onOpenChange: (open: boolean) => void
  staff: User[]
  services: Service[]
  clients: Client[]
  onSuccess: (change: AppointmentDetailChange) => void
  onClientsChanged?: () => void
  readOnly?: boolean
}

export function useAppointmentDetailDrawer({
  appointment,
  onOpenChange,
  staff,
  services,
  clients,
  onSuccess,
  onClientsChanged,
  readOnly = false,
}: UseAppointmentDetailDrawerParams) {
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
    reset: resetEditForm,
    setError: setEditError,
    setValue: setEditValue,
    trigger: triggerEdit,
    watch: watchEdit,
    formState: { isSubmitting: isEditSubmitting },
  } = editForm
  const clientId = watchEdit('clientId') ?? ''
  const useTemporaryClient = Boolean(watchEdit('useTemporaryClient'))
  const temporaryClientName = watchEdit('temporaryClientName') ?? ''
  const temporaryClientNotes = watchEdit('temporaryClientNotes') ?? ''
  const staffId = watchEdit('staffId') ?? ''
  const serviceId = watchEdit('serviceId') ?? ''
  const date = watchEdit('date')
  const startTime = watchEdit('startTime')
  const durationInput = watchEdit('durationMinutes')
  const durationMinutes = parseOptionalLocalizedInteger(durationInput) ?? 45
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

  const serviceIdsWithStaff = useMemo(() => {
    const ids = new Set<string>()
    for (const service of editableServices) {
      if (eligibleStaffForService(staffRoleOnly, service.id).length > 0) {
        ids.add(service.id)
      }
    }
    return ids
  }, [editableServices, staffRoleOnly])

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
    const clamped = clampAppointmentDuration(mins)
    setEditValue('durationMinutes', clamped, { shouldDirty: true })
    setEditValue('endTime', endTimeFromDuration(startTime, clamped), {
      shouldDirty: true,
    })
  }

  const applyEndTime = (et: string) => {
    setEditValue('endTime', et, { shouldDirty: true })
    const d = durationFromEndTime(startTime, et)
    if (d != null) setEditValue('durationMinutes', d, { shouldDirty: true })
  }

  const applyDurationInput = (value: string) => {
    setEditValue('durationMinutes', value, {
      shouldDirty: true,
      shouldValidate: false,
    })
    const parsed = parseOptionalLocalizedInteger(value)
    if (parsed == null) return
    setEditValue('endTime', endTimeFromDuration(startTime, parsed), {
      shouldDirty: true,
    })
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

  const cancelEditing = () => {
    setIsEditing(false)
    setEditingAppointmentId(null)
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
    const next = resolveIntakeServiceChange({
      serviceId: id,
      staffId,
      staffRoleOnly,
      services,
    })
    setEditValue('serviceId', next.serviceId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setEditValue('addonIds', next.addonIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setEditValue('staffId', next.staffId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    applyDuration(next.durationMinutes)
  }

  const clearEditService = () => {
    setEditValue('serviceId', '', { shouldDirty: true, shouldValidate: true })
    setEditValue('addonIds', [], { shouldDirty: true, shouldValidate: true })
  }

  const toggleEditAddon = (addon: ServiceAddon) => {
    const next = resolveIntakeAddonToggle({
      addon,
      addonIds,
      availableAddons: addonOptions,
      selectedService: selectedEditService,
      fallbackDuration: durationMinutes,
    })
    setEditValue('addonIds', next.addonIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
    applyDuration(next.durationMinutes)
  }

  const handleEditStaffChange = (id: string) => {
    setEditValue('staffId', id, { shouldDirty: true, shouldValidate: true })
    const next = resolveIntakeStaffChange({
      staffId: id,
      serviceId,
      staffRoleOnly,
      services,
    })
    if (next.serviceId !== serviceId) {
      setEditValue('serviceId', next.serviceId, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
    if (next.durationMinutes != null) {
      applyDuration(next.durationMinutes)
    }
  }

  const clearEditStaff = () => {
    setEditValue('staffId', '', { shouldDirty: true, shouldValidate: true })
  }

  const handleTemporaryClientModeChange = (enabled: boolean) => {
    if (!appointment) return
    applyTemporaryClientModePatch(
      resolveTemporaryClientModeChange(enabled, {
        prefill:
          enabled && appointment.client.isPlaceholder
            ? {
                name: appointment.client.name,
                notes: appointment.client.notes ?? '',
              }
            : undefined,
      }),
      setEditValue,
    )
  }

  const {
    updateAppointment,
    deleteAppointment,
    updateAppointmentStatus,
    completePlaceholderClient,
    isMutating,
  } = useAppointmentIntakeMutations()

  const submitCompleteClient = handleCompleteSubmit(async (values) => {
    if (!appointment) return

    clearCompleteErrors('root')
    setDuplicateClient(null)

    try {
      const updated = await completePlaceholderClient.mutateAsync({
        appointmentId: appointment.id,
        values,
      })
      setShowCompleteClientDrawer(false)
      setDuplicateClient(null)
      onClientsChanged?.()
      onSuccess({ type: 'updated', appointment: updated, source: 'completeClient' })
    } catch (err) {
      if (isDuplicateClientError(err)) {
        setCompleteFormError('root', { message: err.message })
        setDuplicateClient(duplicateClientFromError(err))
      } else {
        setCompleteFormError('root', {
          message: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
        })
      }
    }
  })

  const handleUpdate = handleEditSubmit(async (values) => {
    if (!appointment) return

    const validationError = validateAppointmentIntakeSubmit({
      values,
      activeServices: editableServices,
      staffRoleOnly,
      serviceIdsWithStaff,
    })
    if (validationError) {
      setEditError(validationError.field, { message: validationError.message })
      return
    }

    try {
      const change = await updateAppointment.mutateAsync({
        appointmentId: appointment.id,
        values,
        nextStatus: status as AppointmentWithDetails['status'],
      })
      onSuccess(
        change.type === 'deleted'
          ? change
          : { ...change, source: 'edit' },
      )
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
    setStatusAction(
      buildStatusActionState({
        nextStatus,
        hasDataClient: false,
        isOnline: true,
        changeType: 'updated',
        phase: 'saving',
      }),
    )

    try {
      const result = await updateAppointmentStatus.mutateAsync({
        appointmentId: appointment.id,
        nextStatus,
      })

      setStatusAction(
        buildStatusActionState({
          nextStatus,
          hasDataClient: false,
          isOnline: true,
          changeType: result.type,
          phase: 'done',
        }),
      )
      onSuccess(
        result.type === 'deleted'
          ? { type: 'deleted', id: result.id }
          : { type: 'updated', appointment: result.appointment, source: 'status' },
      )
    } catch {
      setStatusAction(null)
      // Toast handled by mutation cache.
    }
  }

  const submitPlaceholderClient = () => {
    setCompleteValue('reassignToExistingClientId', undefined)
    void submitCompleteClient()
  }

  const reassignPlaceholderClient = () => {
    if (!duplicateClient) return
    setCompleteValue('reassignToExistingClientId', duplicateClient.id)
    void submitCompleteClient()
  }

  return {
    readOnly,
    statusAction,
    isEditingCurrentAppointment,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showCompleteClientDrawer,
    setShowCompleteClientDrawer,
    duplicateClient,
    handleOpenChange,
    startEditing,
    cancelEditing,
    openCompleteClientDrawer,
    handleStatusChange,
    handleUpdate,
    handleDelete,
    handleClientCreated,
    handleEditServiceChange,
    clearEditService,
    toggleEditAddon,
    handleEditStaffChange,
    clearEditStaff,
    handleTemporaryClientModeChange,
    applyDuration,
    applyDurationInput,
    applyEndTime,
    triggerEdit,
    editForm,
    completeForm,
    completeClientNameRef,
    temporaryClientNameRef,
    completeClientName,
    completeClientPhone,
    completeErrors,
    completePlaceholderClient,
    submitPlaceholderClient,
    reassignPlaceholderClient,
    localClients,
    useTemporaryClient,
    temporaryClientName,
    temporaryClientNotes,
    clientId,
    staffId,
    serviceId,
    date,
    startTime,
    durationInput,
    durationMinutes,
    endTime,
    addonIds,
    staffRoleOnly,
    editableServices,
    selectedEditService,
    addonOptions,
    availableAddons,
    addonsLoading,
    previewDuration,
    previewPrice,
    status,
    setStatus,
    isMutating,
    isEditSubmitting,
  }
}
