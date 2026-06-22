import { describe, expect, it, vi } from 'vitest'

vi.mock('@repo/database/client', () => ({
  getDb: vi.fn(() => ({})),
}))

vi.mock('@repo/notifications', () => ({
  sendSmsOtp: vi.fn(),
}))

import {
  AUTH_OTP_SEND_MAX_PER_WINDOW,
  AUTH_OTP_SEND_WINDOW_SECONDS,
} from './phone-otp'
import { adminAuth, auth, getAuthAppForOrigin } from './server'

describe('Better Auth server config', () => {
  it('enables a strict cooldown for phone OTP send requests', () => {
    expect(auth.options.rateLimit).toMatchObject({
      enabled: true,
      storage: 'memory',
      customRules: {
        '/phone-number/send-otp': {
          window: AUTH_OTP_SEND_WINDOW_SECONDS,
          max: AUTH_OTP_SEND_MAX_PER_WINDOW,
        },
      },
    })
  })

  it('uses independent cookie namespaces for the PWA and admin apps', () => {
    expect(auth.options.advanced?.cookiePrefix).toBe('saluna-pwa')
    expect(adminAuth.options.advanced?.cookiePrefix).toBe('saluna-admin')
  })

  it('maps local app origins to their cookie namespace', () => {
    expect(getAuthAppForOrigin('http://localhost:3000')).toBe('pwa')
    expect(getAuthAppForOrigin('http://localhost:3003')).toBe('admin')
    expect(getAuthAppForOrigin('https://untrusted.example')).toBeNull()
  })
})
