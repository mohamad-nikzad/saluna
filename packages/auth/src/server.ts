import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins/username'
import { phoneNumber } from 'better-auth/plugins/phone-number'
import { organization } from 'better-auth/plugins/organization'
import { bearer } from 'better-auth/plugins/bearer'
import { getDb } from '@repo/database/client'
import {
  hashCredentialPassword,
  verifyCredentialPassword,
} from '@repo/database/auth-password'
import {
  user,
  session,
  account,
  verification,
  organization as organizationTable,
  member,
  invitation,
} from '@repo/database/schema'
import {
  AUTH_OTP_ALLOWED_ATTEMPTS,
  AUTH_OTP_EXPIRES_IN_SECONDS,
  AUTH_OTP_LENGTH,
  AUTH_OTP_SEND_MAX_PER_WINDOW,
  AUTH_OTP_SEND_WINDOW_SECONDS,
  getTempEmailForPhoneNumber,
  getTempNameForPhoneNumber,
  isValidAuthPhoneNumber,
  readAuthOtpConfig,
  sendAuthPhoneOtp,
  verifyBypassAuthPhoneOtp,
} from './phone-otp'

const trustedOrigins = [
  process.env.PWA_ORIGIN,
  process.env.ADMIN_ORIGIN,
  process.env.NODE_ENV !== 'production' ? 'http://localhost:3003' : undefined,
].filter((origin): origin is string => Boolean(origin))
const otpConfig = readAuthOtpConfig()

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'pg',
    schema: {
      user,
      session,
      account,
      verification,
      organization: organizationTable,
      member,
      invitation,
    },
  }),
  basePath: '/api/v1/auth',
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashCredentialPassword,
      verify: ({ hash, password }) => verifyCredentialPassword(hash, password),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7d
    updateAge: 60 * 60 * 24, // roll daily
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: {
    enabled: true,
    storage: 'memory',
    customRules: {
      '/phone-number/send-otp': {
        window: AUTH_OTP_SEND_WINDOW_SECONDS,
        max: AUTH_OTP_SEND_MAX_PER_WINDOW,
      },
    },
  },
  // UUID ids keep Better Auth's PKs compatible with the existing uuid salon_id
  // FK columns across the domain schema.
  advanced: { database: { generateId: 'uuid' } },
  plugins: [
    username({ minUsernameLength: 10, maxUsernameLength: 15 }), // 11-digit 09xxxxxxxxx fits
    phoneNumber({
      otpLength: AUTH_OTP_LENGTH,
      expiresIn: AUTH_OTP_EXPIRES_IN_SECONDS,
      allowedAttempts: AUTH_OTP_ALLOWED_ATTEMPTS,
      phoneNumberValidator: isValidAuthPhoneNumber,
      sendOTP: sendAuthPhoneOtp,
      ...(otpConfig.bypassEnabled
        ? { verifyOTP: verifyBypassAuthPhoneOtp }
        : {}),
      signUpOnVerification: {
        getTempEmail: getTempEmailForPhoneNumber,
        getTempName: getTempNameForPhoneNumber,
      },
    }),
    organization({ allowUserToCreateOrganization: false }), // only the signup wrapper creates orgs
    bearer(), // native bearer-token transport (future)
  ],
  trustedOrigins,
})
