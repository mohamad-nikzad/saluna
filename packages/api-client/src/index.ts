export { createApiClient } from './client'
export type { ApiClient, ApiClientOptions, RequestOptions, TokenProvider } from './client'
export { createAuthApi } from './auth'
export type {
  AuthApi,
  LoginInput,
  LoginResponse,
  SignupInput,
  SignupResponse,
  MeResponse,
} from './auth'
export { createTodayApi } from './today'
export type { TodayApi } from './today'
export { createDashboardApi } from './dashboard'
export type { DashboardApi, DashboardData } from './dashboard'
export { createOnboardingApi } from './onboarding'
export type {
  OnboardingAction,
  OnboardingApi,
  OnboardingResponse,
  OnboardingStatus,
} from './onboarding'
export { createRetentionApi } from './retention'
export type {
  RetentionApi,
  RetentionQueueResponse,
  UpdateRetentionItemResponse,
} from './retention'
export { createBusinessSettingsApi } from './business-settings'
export type {
  BusinessSettingsApi,
  BusinessSettingsResponse,
  UpdateBusinessSettingsInput,
} from './business-settings'
export { createClientsApi } from './clients'
export type {
  ClientResponse,
  ClientsApi,
  ClientsResponse,
  CreateClientFollowUpInput,
  CreateClientFollowUpResponse,
  CreateClientInput,
  CreateClientResponse,
  UpdateClientInput,
} from './clients'
export { createStaffApi } from './staff'
export type {
  CreateStaffInput,
  CreateStaffResponse,
  StaffApi,
  StaffMemberResponse,
  StaffResponse,
  StaffScheduleResponse,
  UpdateStaffScheduleInput,
  UpdateStaffServicesInput,
} from './staff'
export { createServicesApi } from './services'
export type {
  CreateServiceInput,
  ServiceResponse,
  ServicesApi,
  ServicesResponse,
  UpdateServiceInput,
} from './services'
export { createAppointmentsApi } from './appointments'
export type {
  AppointmentAvailabilityInput,
  AppointmentResponse,
  AppointmentsApi,
  AppointmentsRangeResponse,
  CompletePlaceholderClientInput,
  CompletePlaceholderClientResponse,
  CreateAppointmentInput,
  CreateAppointmentResponse,
  DeleteAppointmentResponse,
  UpdateAppointmentInput,
  UpdateAppointmentResponse,
  UpdateAppointmentStatusResponse,
} from './appointments'
export {
  createNotificationPreferencesApi,
  createNotificationsApi,
} from './notifications'
export type {
  AppNotification,
  MarkAllNotificationsReadResponse,
  NotificationPreferences,
  NotificationPreferencesApi,
  NotificationPreferencesResponse,
  NotificationResponse,
  NotificationsApi,
  NotificationsResponse,
  NotificationType,
  UpdateNotificationPreferencesInput,
} from './notifications'
export { endpoints } from './endpoints'
export { ApiError, NetworkError } from './errors'
