export {
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getAppointmentWithDetailsById,
  getAppointmentsByDateRange,
  getAppointmentsWithDetailsByDateRange,
  getClientAppointmentsWithDetails,
  getScheduleOverlapFlags,
  updateAppointment,
} from './internal/appointment-queries'

export { getManagerAppointmentAvailability } from './internal/appointment-availability'

export {
  validateCreateAppointmentIntake,
  validateUpdateAppointmentIntake,
} from './internal/appointment-intake'

export { getClientById } from './internal/client-queries'

export { getServiceById } from './internal/service-queries'

export {
  checkStaffAvailabilityForAppointment,
  staffMayPerformService,
} from './internal/staff-queries'

export { getUserById } from './internal/user-queries'
