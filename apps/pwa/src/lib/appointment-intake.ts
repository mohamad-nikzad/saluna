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
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'
import type {
  AppointmentWithDetails,
  Service,
  ServiceAddon,
  User,
} from '@repo/salon-core/types'

import { statusChangeFeedbackMessage } from '#/lib/appointment-detail-view-model'

/** Prefill for the create drawer after calendar slot or availability pick. */
export type AppointmentCreateIntent = {
  date: string
  time: string
  staffId?: string
  serviceId?: string
  clientId?: string
}

export type AppointmentAvailabilitySelection = {
  slot: {
    date: string
    startTime: string
    staffId: string
  }
  serviceId: string
}

export type AppointmentStatusActionState = {
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'queued'
  message: string
} | null

export type AppointmentCreateViewModel = {
  staffRoleOnly: User[]
  activeServices: Service[]
  selectedStaff: User | undefined
  selectedService: Service | undefined
  selectedAddons: ServiceAddon[]
  previewDuration: number
  previewPrice: number
  serviceIdsWithStaff: Set<string>
  selectedStaffEligibleServiceIds: Set<string>
  staffServiceCounts: Map<string, number>
  serviceIdsWithAvailableStaff: Set<string>
  selectedServiceHasStaff: boolean
  selectedStaffHasServices: boolean
  selectedStaffCanPerformSelectedService: boolean
  serviceDisabledReason: (service: Service) => string | null
  serviceStatusReason: (service: Service) => string | null
  staffPickerStatus: (
    member: User,
  ) => { disabled: true; reason: string } | undefined
}

export function calculatedAppointmentPrice(
  service: Service | undefined,
  addons: ServiceAddon[],
): number {
  return (
    (service?.price ?? 0) +
    addons.reduce((sum, addon) => sum + addon.priceDelta, 0)
  )
}

/** Service ids that have at least one eligible staff member. */
export function serviceIdsWithStaffSet(
  staffRoleOnly: User[],
  services: Service[],
): Set<string> {
  const ids = new Set<string>()
  for (const service of services) {
    if (eligibleStaffForService(staffRoleOnly, service.id).length > 0) {
      ids.add(service.id)
    }
  }
  return ids
}

export function appointmentCreateFormDefaults({
  initialDate,
  initialTime,
  initialStaffId,
  initialServiceId,
  initialClientId,
  services,
}: {
  initialDate: string
  initialTime: string
  initialStaffId?: string
  initialServiceId?: string
  initialClientId?: string
  services: Service[]
}): AppointmentFormInput {
  const initialService = initialServiceId
    ? services.find((service) => service.id === initialServiceId)
    : undefined
  const defaultDuration = initialService?.duration ?? 45
  const startTime = formatTimeHm(parseTimeHm(initialTime))

  return {
    useTemporaryClient: false,
    clientId: initialClientId ?? '',
    staffId: initialStaffId ?? '',
    serviceId: initialServiceId ?? '',
    date: initialDate,
    startTime,
    endTime: endTimeFromDuration(startTime, defaultDuration),
    durationMinutes: defaultDuration,
    finalPrice: calculatedAppointmentPrice(initialService, []),
    notes: '',
    temporaryClientName: '',
    temporaryClientNotes: '',
    addonIds: [],
  }
}

export function buildAppointmentCreateViewModel({
  staff,
  services,
  staffId,
  serviceId,
  addonIds,
  availableAddons,
  durationMinutes,
  staffSlotOk,
}: {
  staff: User[]
  services: Service[]
  staffId: string
  serviceId: string
  addonIds: string[]
  availableAddons: ServiceAddon[]
  durationMinutes: number
  staffSlotOk: Record<string, boolean>
}): AppointmentCreateViewModel {
  const activeServices = services.filter((service) => service.active)
  const staffRoleOnly = staff.filter((member) => member.role === 'staff')
  const selectedStaff = staffRoleOnly.find((member) => member.id === staffId)
  const selectedService = activeServices.find(
    (service) => service.id === serviceId,
  )
  const selectedAddons = availableAddons.filter((addon) =>
    addonIds.includes(addon.id),
  )
  const previewDuration =
    (selectedService?.duration ?? durationMinutes) +
    selectedAddons.reduce((sum, addon) => sum + addon.durationDelta, 0)
  const previewPrice = calculatedAppointmentPrice(
    selectedService,
    selectedAddons,
  )

  const serviceIdsWithStaff = serviceIdsWithStaffSet(
    staffRoleOnly,
    activeServices,
  )

  const selectedStaffEligibleServiceIds = selectedStaff
    ? new Set(
        eligibleServicesForStaff(selectedStaff, activeServices).map(
          (service) => service.id,
        ),
      )
    : new Set<string>()

  const staffServiceCounts = new Map<string, number>()
  for (const member of staffRoleOnly) {
    staffServiceCounts.set(
      member.id,
      eligibleServicesForStaff(member, activeServices).length,
    )
  }

  const serviceIdsWithAvailableStaff = new Set<string>()
  for (const service of activeServices) {
    const eligible = eligibleStaffForService(staffRoleOnly, service.id)
    if (eligible.some((member) => staffSlotOk[member.id] !== false)) {
      serviceIdsWithAvailableStaff.add(service.id)
    }
  }

  const serviceDisabledReason = (service: Service) => {
    if (!serviceIdsWithStaff.has(service.id)) return 'بدون پرسنل'
    if (selectedStaff && !selectedStaffEligibleServiceIds.has(service.id)) {
      return 'برای این پرسنل نیست'
    }
    return null
  }

  const serviceStatusReason = (service: Service) => {
    if (!serviceIdsWithStaff.has(service.id)) return null
    if (serviceIdsWithAvailableStaff.has(service.id)) return null
    return 'برای این ساعت در دسترس نیست'
  }

  const staffPickerStatus = (member: User) => {
    const unavailable = staffSlotOk[member.id] === false
    const noServices = (staffServiceCounts.get(member.id) ?? 0) === 0
    const serviceMismatch =
      !!serviceId && !eligibleStaffForService([member], serviceId).length
    if (unavailable)
      return { disabled: true as const, reason: 'خارج از برنامه' }
    if (noServices) return { disabled: true as const, reason: 'خدمتی ندارد' }
    if (serviceMismatch) {
      return { disabled: true as const, reason: 'این خدمت را انجام نمی‌دهد' }
    }
    return undefined
  }

  return {
    staffRoleOnly,
    activeServices,
    selectedStaff,
    selectedService,
    selectedAddons,
    previewDuration,
    previewPrice,
    serviceIdsWithStaff,
    selectedStaffEligibleServiceIds,
    staffServiceCounts,
    serviceIdsWithAvailableStaff,
    selectedServiceHasStaff:
      !selectedService || serviceIdsWithStaff.has(selectedService.id),
    selectedStaffHasServices:
      !staffId || (staffServiceCounts.get(staffId) ?? 0) > 0,
    selectedStaffCanPerformSelectedService:
      !staffId ||
      !serviceId ||
      Boolean(selectedStaff && selectedStaffEligibleServiceIds.has(serviceId)),
    serviceDisabledReason,
    serviceStatusReason,
    staffPickerStatus,
  }
}

export function clampAppointmentDuration(mins: number): number {
  return Math.min(
    APPOINTMENT_DURATION_BOUNDS.max,
    Math.max(APPOINTMENT_DURATION_BOUNDS.min, mins),
  )
}

export function catalogDurationMinutes(
  baseService: Service | undefined,
  addons: ServiceAddon[],
  fallback = 45,
): number {
  return (
    (baseService?.duration ?? fallback) +
    addons.reduce((sum, addon) => sum + addon.durationDelta, 0)
  )
}

export function durationFromEndTime(
  startTime: string,
  endTime: string,
): number | null {
  try {
    const d = durationMinutesFromRange(startTime, endTime)
    return d > 0 ? d : null
  } catch {
    return null
  }
}

export type IntakeServiceChangeResult = {
  serviceId: string
  staffId: string
  addonIds: string[]
  durationMinutes: number
}

/** Keeps staff/service/addon selections consistent after a service change. */
export function resolveIntakeServiceChange({
  serviceId,
  staffId,
  staffRoleOnly,
  services,
}: {
  serviceId: string
  staffId: string
  staffRoleOnly: User[]
  services: Service[]
}): IntakeServiceChangeResult {
  const svc = services.find((service) => service.id === serviceId)
  const eligibleStaffMembers = eligibleStaffForService(staffRoleOnly, serviceId)
  const currentStillEligible =
    !!staffId && eligibleStaffMembers.some((member) => member.id === staffId)

  let nextStaffId = staffId
  if (!currentStillEligible) {
    nextStaffId =
      eligibleStaffMembers.length > 0 ? eligibleStaffMembers[0].id : ''
  }

  return {
    serviceId,
    staffId: nextStaffId,
    addonIds: [],
    durationMinutes: svc?.duration ?? 45,
  }
}

export type IntakeStaffChangeResult = {
  staffId: string
  serviceId: string
  durationMinutes?: number
}

/** Keeps staff/service selections consistent after a staff change. */
export function resolveIntakeStaffChange({
  staffId,
  serviceId,
  staffRoleOnly,
  services,
}: {
  staffId: string
  serviceId: string
  staffRoleOnly: User[]
  services: Service[]
}): IntakeStaffChangeResult {
  const member = staffRoleOnly.find((item) => item.id === staffId)
  if (!member) return { staffId, serviceId }

  const eligible = eligibleServicesForStaff(member, services)
  const current = services.find((service) => service.id === serviceId)
  const serviceStillOk =
    !!current && eligible.some((service) => service.id === serviceId)

  if (serviceStillOk) return { staffId, serviceId }

  const explicitList = member.serviceIds != null && member.serviceIds.length > 0
  const auto = autoPickServiceForStaff(eligible, {
    staffHasExplicitServiceList: explicitList,
  })

  if (auto) {
    return { staffId, serviceId: auto.id, durationMinutes: auto.duration }
  }
  return { staffId, serviceId: '' }
}

export type TemporaryClientModeChangeResult = {
  useTemporaryClient: boolean
  clientId?: string
  temporaryClientName: string
  temporaryClientNotes: string
}

/** Atomic patch when toggling placeholder / fill-later client mode. */
export function resolveTemporaryClientModeChange(
  enabled: boolean,
  options?: {
    prefill?: { name: string; notes?: string }
  },
): TemporaryClientModeChangeResult {
  if (enabled) {
    return {
      useTemporaryClient: true,
      clientId: '',
      temporaryClientName: options?.prefill?.name ?? '',
      temporaryClientNotes: options?.prefill?.notes ?? '',
    }
  }
  return {
    useTemporaryClient: false,
    temporaryClientName: '',
    temporaryClientNotes: '',
  }
}

export function applyTemporaryClientModePatch(
  patch: TemporaryClientModeChangeResult,
  setValue: (
    name: keyof AppointmentFormInput,
    value: AppointmentFormInput[keyof AppointmentFormInput],
    options?: { shouldDirty?: boolean; shouldValidate?: boolean },
  ) => void,
) {
  setValue('useTemporaryClient', patch.useTemporaryClient, {
    shouldDirty: true,
    shouldValidate: true,
  })
  if (patch.clientId !== undefined) {
    setValue('clientId', patch.clientId, { shouldDirty: true })
  }
  setValue('temporaryClientName', patch.temporaryClientName, {
    shouldDirty: true,
  })
  setValue('temporaryClientNotes', patch.temporaryClientNotes, {
    shouldDirty: true,
  })
}

export type IntakeAddonToggleResult = {
  addonIds: string[]
  durationMinutes: number
}

export function resolveIntakeAddonToggle({
  addon,
  addonIds,
  availableAddons,
  selectedService,
  fallbackDuration = 45,
}: {
  addon: ServiceAddon
  addonIds: string[]
  availableAddons: ServiceAddon[]
  selectedService: Service | undefined
  fallbackDuration?: number
}): IntakeAddonToggleResult {
  const nextIds = addonIds.includes(addon.id)
    ? addonIds.filter((id) => id !== addon.id)
    : [...addonIds, addon.id]
  const nextAddons = availableAddons.filter((item) => nextIds.includes(item.id))

  return {
    addonIds: nextIds,
    durationMinutes: catalogDurationMinutes(
      selectedService,
      nextAddons,
      fallbackDuration,
    ),
  }
}

export type AppointmentIntakeValidationError =
  | { field: 'serviceId'; message: string }
  | { field: 'staffId'; message: string }
  | { field: 'root'; message: string }

/** Eligibility + window checks shared by create and edit intake. */
export function validateAppointmentIntakeSubmit({
  values,
  activeServices,
  staffRoleOnly,
  serviceIdsWithStaff,
}: {
  values: Pick<
    AppointmentFormInput,
    'serviceId' | 'staffId' | 'startTime' | 'endTime'
  >
  activeServices: Service[]
  staffRoleOnly: User[]
  serviceIdsWithStaff: Set<string>
}): AppointmentIntakeValidationError | null {
  const currentService = activeServices.find(
    (service) => service.id === values.serviceId,
  )
  const currentStaff = staffRoleOnly.find(
    (member) => member.id === values.staffId,
  )

  if (currentService && !serviceIdsWithStaff.has(currentService.id)) {
    return {
      field: 'serviceId',
      message: 'برای این خدمت هنوز پرسنلی تعریف نشده است.',
    }
  }

  if (
    currentStaff &&
    eligibleServicesForStaff(currentStaff, activeServices).length === 0
  ) {
    return {
      field: 'staffId',
      message: 'برای این پرسنل هنوز خدمتی تعریف نشده است.',
    }
  }

  if (
    currentStaff &&
    currentService &&
    !eligibleServicesForStaff(currentStaff, activeServices).some(
      (service) => service.id === currentService.id,
    )
  ) {
    return {
      field: 'staffId',
      message: 'این پرسنل نمی‌تواند خدمت انتخاب‌شده را انجام دهد.',
    }
  }

  const localCheck = validateAppointmentWindow(values.startTime, values.endTime)
  if (!localCheck.ok) {
    return { field: 'root', message: localCheck.error }
  }

  return null
}

export function buildStatusActionState({
  nextStatus,
  hasDataClient,
  isOnline,
  changeType,
  phase,
}: {
  nextStatus: AppointmentWithDetails['status']
  hasDataClient: boolean
  isOnline: boolean
  changeType: 'deleted' | 'updated'
  phase: 'saving' | 'done'
}): AppointmentStatusActionState {
  if (phase === 'saving') {
    return {
      status: nextStatus,
      mode: 'saving',
      message: 'در حال ثبت وضعیت...',
    }
  }

  return {
    status: nextStatus,
    mode: hasDataClient && !isOnline ? 'queued' : 'saved',
    message: statusChangeFeedbackMessage({
      hasDataClient,
      isOnline,
      changeType,
    }),
  }
}

export function availabilitySelectionToCreateIntent(
  selection: AppointmentAvailabilitySelection,
): AppointmentCreateIntent {
  return {
    date: selection.slot.date,
    time: selection.slot.startTime,
    staffId: selection.slot.staffId,
    serviceId: selection.serviceId,
  }
}

export function emptyCreateIntent(
  date: string,
  time: string,
): AppointmentCreateIntent {
  return { date, time }
}
