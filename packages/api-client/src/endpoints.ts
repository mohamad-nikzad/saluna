// Single source of truth for endpoint paths.
// When the backend moves off Next.js API routes, only these strings change.
export const endpoints = {
  auth: {
    login: '/api/auth/login',
    signup: '/api/auth/signup',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
  },
  today: '/api/today',
  dashboard: '/api/dashboard',
  onboarding: '/api/onboarding',
  retention: '/api/retention',
  clients: '/api/clients',
  staff: '/api/staff',
  services: '/api/services',
  appointments: '/api/appointments',
  appointmentsAvailability: '/api/appointments/availability',
  notifications: '/api/notifications',
  notificationTest: '/api/notifications/test',
  notificationPreferences: '/api/notification-preferences',
  businessSettings: '/api/settings/business',
} as const
