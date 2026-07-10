// Auth endpoint paths for the legacy hand-written client.
// All paths point at Hono (`/api/v1/*`). The client's `baseUrl` is the
// origin (e.g. `https://api.saluna.ir`), and these paths are appended.
export const endpoints = {
  auth: {
    signIn: '/api/v1/auth/sign-in/username',
    signInPhoneNumber: '/api/v1/auth/sign-in/phone-number',
    sendPhoneOtp: '/api/v1/auth/phone-number/send-otp',
    verifyPhoneOtp: '/api/v1/auth/phone-number/verify',
    completeStaffClaim: '/api/v1/auth/staff-claim/password',
    requestPasswordReset: '/api/v1/auth/phone-number/request-password-reset',
    verifyPasswordResetOtp:
      '/api/v1/auth/phone-number/verify-password-reset-otp',
    resetPassword: '/api/v1/auth/reset-password',
    phoneStatus: '/api/v1/auth/phone-status',
    signup: '/api/v1/auth/signup',
    signupAccount: '/api/v1/auth/signup/account',
    signupWorkspace: '/api/v1/auth/signup/workspace',
    signOut: '/api/v1/auth/sign-out',
    me: '/api/v1/auth/me',
    staffSalons: '/api/v1/auth/staff-salons',
    staffInvites: '/api/v1/auth/staff-invites',
  },
  salonHandoff: '/api/v1/salon-handoff',
} as const
