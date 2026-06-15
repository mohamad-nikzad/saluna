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
import { auth } from './server'

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
})
