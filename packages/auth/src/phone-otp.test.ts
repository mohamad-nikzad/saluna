import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendSmsOtp: vi.fn(),
}))

vi.mock('@repo/notifications', () => ({
  sendSmsOtp: mocks.sendSmsOtp,
}))

import {
  DEFAULT_AUTH_OTP_BYPASS_CODE,
  getTempEmailForPhoneNumber,
  isValidAuthPhoneNumber,
  normalizeAuthPhoneNumber,
  readAuthOtpConfig,
  sendAuthPhoneOtp,
  verifyBypassAuthPhoneOtp,
} from './phone-otp'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('phone OTP auth config', () => {
  it('normalizes and validates Iranian mobile numbers', () => {
    expect(normalizeAuthPhoneNumber('+98 912 345 6789')).toBe('09123456789')
    expect(isValidAuthPhoneNumber('+98 912 345 6789')).toBe(true)
    expect(isValidAuthPhoneNumber('02112345678')).toBe(false)
  })

  it('defaults bypass code to the agreed dev/test code', () => {
    expect(readAuthOtpConfig({ AUTH_OTP_BYPASS_ENABLED: 'true' })).toEqual({
      bypassEnabled: true,
      bypassCode: DEFAULT_AUTH_OTP_BYPASS_CODE,
    })
  })

  it('uses normalized phone placeholder emails for OTP-created users', () => {
    expect(getTempEmailForPhoneNumber('+98 912 345 6789')).toBe(
      '09123456789@saluna.local',
    )
  })

  it('skips SMS and accepts only the configured bypass code in bypass mode', async () => {
    vi.stubEnv('AUTH_OTP_BYPASS_ENABLED', 'true')
    vi.stubEnv('AUTH_OTP_BYPASS_CODE', '654321')

    await expect(
      sendAuthPhoneOtp({ phoneNumber: '09123456789', code: '111111' }),
    ).resolves.toBeUndefined()

    expect(mocks.sendSmsOtp).not.toHaveBeenCalled()
    expect(verifyBypassAuthPhoneOtp({ code: '654321' })).toBe(true)
    expect(verifyBypassAuthPhoneOtp({ code: '123456' })).toBe(false)
  })

  it('sends real OTPs through the SMS delivery layer outside bypass mode', async () => {
    mocks.sendSmsOtp.mockResolvedValue({ status: 'sent', provider: 'sms_ir' })

    await sendAuthPhoneOtp({ phoneNumber: '+98 912 345 6789', code: '112233' })

    expect(mocks.sendSmsOtp).toHaveBeenCalledWith({
      phone: '09123456789',
      code: '112233',
      purpose: 'signup',
      requestId: 'auth-otp:09123456789',
    })
  })

  it('fails OTP send when the configured SMS provider cannot deliver', async () => {
    mocks.sendSmsOtp.mockResolvedValue({
      status: 'skipped',
      provider: 'sms_ir',
      error: 'missing_template',
    })

    await expect(
      sendAuthPhoneOtp({ phoneNumber: '09123456789', code: '112233' }),
    ).rejects.toThrow('missing_template')
  })
})
