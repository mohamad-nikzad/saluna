import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from './env'
import { readSmsDeliveryConfigFromEnv } from './env'

function env(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3002,
    DATABASE_URL: 'postgres://stub',
    CORS_ORIGINS: ['*'],
    MESSAGING_LINK_TOKEN_TTL_MINUTES: 15,
    TELEGRAM_ENABLED: false,
    BALE_ENABLED: false,
    BALE_SAFIR_ENABLED: false,
    SMS_ENABLED: false,
    AUTH_OTP_BYPASS_ENABLED: false,
    AUTH_OTP_BYPASS_CODE: '123456',
    ...overrides,
  }
}

describe('env SMS delivery config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('delegates SMS env mapping without baking OTP template fallbacks per purpose', () => {
    expect(
      readSmsDeliveryConfigFromEnv(
        env({
          SMS_ENABLED: true,
          SMS_PROVIDER: 'sms_ir',
          SMS_IR_API_KEY: ' secret-api-key ',
          SMS_IR_OTP_TEMPLATE_ID: '123456',
          SMS_IR_OTP_PARAMETER_NAME: 'CODE',
        }),
      ),
    ).toEqual({
      provider: 'sms_ir',
      smsIr: {
        apiKey: 'secret-api-key',
        lineNumber: null,
        otpTemplateId: '123456',
        otpParameterName: 'CODE',
        apiBaseUrl: null,
        templates: {
          login: undefined,
          signup: undefined,
          forgot_password: undefined,
          appointment_request: undefined,
        },
      },
    })
  })

  it('allows SMS to boot without a line number for OTP-only rollout', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DATABASE_URL', 'postgres://stub')
    vi.stubEnv('SMS_ENABLED', 'true')
    vi.stubEnv('SMS_PROVIDER', 'sms_ir')
    vi.stubEnv('SMS_IR_API_KEY', 'secret-api-key')

    const { getEnv } = await import('./env')

    expect(getEnv()).toMatchObject({
      SMS_ENABLED: true,
      SMS_PROVIDER: 'sms_ir',
      SMS_IR_API_KEY: 'secret-api-key',
      AUTH_OTP_BYPASS_ENABLED: false,
      AUTH_OTP_BYPASS_CODE: '123456',
    })
  })

  it('parses OTP bypass envs for dev and test flows', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DATABASE_URL', 'postgres://stub')
    vi.stubEnv('AUTH_OTP_BYPASS_ENABLED', 'true')
    vi.stubEnv('AUTH_OTP_BYPASS_CODE', '654321')

    const { getEnv } = await import('./env')

    expect(getEnv()).toMatchObject({
      AUTH_OTP_BYPASS_ENABLED: true,
      AUTH_OTP_BYPASS_CODE: '654321',
    })
  })
})
