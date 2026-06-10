import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time'
import type {
  AppointmentWithDetails,
  BookedAppointmentAddonLine,
  Client,
  Service,
  ServiceAddon,
  User,
} from '@repo/salon-core/types'
import type { AppointmentFormInput } from '@repo/salon-core/forms/appointment'

export const tomansFormatter = new Intl.NumberFormat('fa-IR')

export function formatTomans(price: number) {
  return `${tomansFormatter.format(price)} تومان`
}

export const STATUS_CHANGE_SEGMENTS = (
  ['scheduled', 'confirmed', 'completed', 'cancelled'] as const
).map((key) => ({ key, label: APPOINTMENT_STATUS[key].label }))

export function filterStaffRoleOnly(staff: User[]) {
  return staff.filter((member) => member.role === 'staff')
}

export function historicalAddonsFromAppointment(
  bookedAddons: BookedAppointmentAddonLine[] | undefined,
): ServiceAddon[] {
  return (bookedAddons ?? []).map((addon) => ({
    id: addon.serviceAddonId,
    salonId: '',
    name: addon.bookedAddonName,
    priceDelta: addon.bookedAddonPriceDelta,
    durationDelta: addon.bookedAddonDurationDelta,
    active: false,
    sortOrder: addon.sortOrder,
    scopes: [],
    createdAt: addon.createdAt,
    updatedAt: addon.createdAt,
  }))
}

export function mergeAddonOptions(
  availableAddons: ServiceAddon[],
  historicalAddonOptions: ServiceAddon[],
) {
  const byId = new Map<string, ServiceAddon>()
  for (const addon of historicalAddonOptions) byId.set(addon.id, addon)
  for (const addon of availableAddons) byId.set(addon.id, addon)
  return Array.from(byId.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'),
  )
}

export function selectAddonsByIds(
  addonOptions: ServiceAddon[],
  addonIds: string[],
) {
  return addonOptions.filter((addon) => addonIds.includes(addon.id))
}

export function isHistoricalAddon(
  addonId: string,
  availableAddons: ServiceAddon[],
) {
  return !availableAddons.some((item) => item.id === addonId)
}

export function computeEditPreview({
  serviceDuration,
  servicePrice,
  fallbackBookedPrice,
  durationMinutes,
  selectedAddons,
}: {
  serviceDuration?: number
  servicePrice?: number
  fallbackBookedPrice: number
  durationMinutes: number
  selectedAddons: ServiceAddon[]
}) {
  const previewDuration =
    (serviceDuration ?? durationMinutes) +
    selectedAddons.reduce((sum, addon) => sum + addon.durationDelta, 0)
  const previewPrice =
    (servicePrice ?? fallbackBookedPrice) +
    selectedAddons.reduce((sum, addon) => sum + addon.priceDelta, 0)
  return { previewDuration, previewPrice }
}

export function editableServices(services: Service[], serviceId: string) {
  return services.filter(
    (service) => service.active || service.id === serviceId,
  )
}

export function clientsForAppointmentEdit(
  appointment: AppointmentWithDetails,
  clients: Client[],
) {
  if (
    appointment.client.isPlaceholder &&
    !clients.some((client) => client.id === appointment.client.id)
  ) {
    return [appointment.client, ...clients]
  }
  return clients
}

export function appointmentEditFormDefaults(
  appointment: AppointmentWithDetails,
): AppointmentFormInput {
  return {
    useTemporaryClient: appointment.client.isPlaceholder,
    temporaryClientName: appointment.client.isPlaceholder
      ? appointment.client.name
      : '',
    temporaryClientNotes: appointment.client.isPlaceholder
      ? (appointment.client.notes ?? '')
      : '',
    clientId: appointment.client.isPlaceholder ? '' : appointment.clientId,
    staffId: appointment.staffId,
    serviceId: appointment.serviceId,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    durationMinutes: durationMinutesFromRange(
      appointment.startTime,
      appointment.endTime,
    ),
    notes: appointment.notes || '',
    addonIds:
      appointment.bookedAddons?.map((addon) => addon.serviceAddonId) ?? [],
  }
}

export function statusChangeFeedbackMessage({
  hasDataClient,
  isOnline,
  changeType,
}: {
  hasDataClient: boolean
  isOnline: boolean
  changeType: 'deleted' | 'updated'
}) {
  const offlineQueued = hasDataClient && !isOnline
  if (changeType === 'deleted') {
    return offlineQueued
      ? 'لغو رزرو موقت آفلاین ثبت شد و بعدا همگام می‌شود.'
      : 'رزرو موقت لغو و حذف شد.'
  }
  return offlineQueued
    ? 'وضعیت نوبت آفلاین ثبت شد و بعدا همگام می‌شود.'
    : 'وضعیت نوبت ثبت شد.'
}

export type AppointmentDetailEditViewModel = {
  staffRoleOnly: User[]
  selectedEditService: Service | undefined
  addonOptions: ServiceAddon[]
  selectedAddons: ServiceAddon[]
  previewDuration: number
  previewPrice: number
  editableServices: Service[]
}

export function buildAppointmentDetailEditViewModel({
  staff,
  services,
  serviceId,
  availableAddons,
  appointment,
  addonIds,
  durationMinutes,
}: {
  staff: User[]
  services: Service[]
  serviceId: string
  availableAddons: ServiceAddon[]
  appointment: AppointmentWithDetails | null
  addonIds: string[]
  durationMinutes: number
}): AppointmentDetailEditViewModel {
  const staffRoleOnly = filterStaffRoleOnly(staff)
  const selectedEditService = services.find(
    (service) => service.id === serviceId,
  )
  const historicalAddonOptions = historicalAddonsFromAppointment(
    appointment?.bookedAddons,
  )
  const addonOptions = mergeAddonOptions(
    availableAddons,
    historicalAddonOptions,
  )
  const selectedAddons = selectAddonsByIds(addonOptions, addonIds)
  const { previewDuration, previewPrice } = computeEditPreview({
    serviceDuration: selectedEditService?.duration,
    servicePrice: selectedEditService?.price,
    fallbackBookedPrice: appointment?.bookedServicePrice ?? 0,
    durationMinutes,
    selectedAddons,
  })

  return {
    staffRoleOnly,
    selectedEditService,
    addonOptions,
    selectedAddons,
    previewDuration,
    previewPrice,
    editableServices: editableServices(services, serviceId),
  }
}
