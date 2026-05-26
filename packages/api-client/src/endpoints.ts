// Single source of truth for endpoint paths.
// All paths point at Hono (`/api/v1/*`). The client's `baseUrl` is the
// origin (e.g. `https://api.saloora.beauty`), and these paths are appended.
export const endpoints = {
  auth: {
    login: '/api/v1/auth/login',
    signup: '/api/v1/auth/signup',
    logout: '/api/v1/auth/logout',
    me: '/api/v1/auth/me',
  },
  today: '/api/v1/today',
  dashboard: '/api/v1/dashboard',
  onboarding: '/api/v1/onboarding',
  retention: '/api/v1/retention',
  clients: '/api/v1/clients',
  staff: '/api/v1/staff',
  services: '/api/v1/services',
  serviceAddons: '/api/v1/service-addons',
  serviceCategories: '/api/v1/service-categories',
  serviceFamilies: '/api/v1/service-families',
  importStarterServiceTemplates: '/api/v1/services/import-starter-templates',
  appointments: '/api/v1/appointments',
  appointmentsAvailability: '/api/v1/appointments/availability',
  appointmentRequests: '/api/v1/appointment-requests',
  notifications: '/api/v1/notifications',
  notificationTest: '/api/v1/notifications/test',
  notificationPreferences: '/api/v1/notification-preferences',
  businessSettings: '/api/v1/settings/business',
} as const
