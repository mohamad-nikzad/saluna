import type { AppointmentWithDetails } from '@repo/salon-core/types'

export type {
  AppointmentDetailEditViewModel,
} from '#/lib/appointment-detail-view-model'

export {
  STATUS_CHANGE_SEGMENTS,
  appointmentEditFormDefaults,
  buildAppointmentDetailEditViewModel,
  clientsForAppointmentEdit,
  computeEditPreview,
  filterStaffRoleOnly,
  formatTomans,
  historicalAddonsFromAppointment,
  isHistoricalAddon,
  mergeAddonOptions,
  selectAddonsByIds,
  statusChangeFeedbackMessage,
  tomansFormatter,
} from '#/lib/appointment-detail-view-model'

export { useStaffBookingAvailability } from '#/lib/use-staff-booking-availability'

export type {
  AppointmentAvailabilitySelection,
  AppointmentCreateIntent,
  AppointmentCreateViewModel,
  AppointmentIntakeValidationError,
  AppointmentStatusActionState,
  IntakeAddonToggleResult,
  IntakeServiceChangeResult,
  IntakeStaffChangeResult,
} from '#/lib/appointment-intake'

export {
  appointmentCreateFormDefaults,
  availabilitySelectionToCreateIntent,
  buildAppointmentCreateViewModel,
  buildStatusActionState,
  catalogDurationMinutes,
  clampAppointmentDuration,
  durationFromEndTime,
  emptyCreateIntent,
  resolveIntakeAddonToggle,
  resolveIntakeServiceChange,
  resolveIntakeStaffChange,
  serviceIdsWithStaffSet,
  validateAppointmentIntakeSubmit,
} from '#/lib/appointment-intake'

export type AppointmentDetailChangeSource = 'edit' | 'status' | 'completeClient'

/** Result of a detail drawer mutation (edit, status, complete client). */
export type AppointmentDetailChange =
  | { type: 'updated'; appointment: AppointmentWithDetails; source: AppointmentDetailChangeSource }
  | { type: 'deleted'; id: string }
