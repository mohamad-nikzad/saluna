import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../env'
import {
  assertBaleWebhookUrl,
  buildBaleSetWebhookRequest,
  parseProviderArg,
  resolveBaleWebhookInput,
  setBaleWebhook,
} from './messaging-set-webhook'

const baleConfig = {
  botToken: 'bale-token',
  botUsername: 'saluna_bot',
  webhookSecret: 'secret-123',
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3002,
    DATABASE_URL: 'postgres://stub',
    CORS_ORIGINS: ['*'],
    MESSAGING_LINK_TOKEN_TTL_MINUTES: 15,
    TELEGRAM_ENABLED: false,
    BALE_ENABLED: true,
    BALE_BOT_TOKEN: baleConfig.botToken,
    BALE_BOT_USERNAME: baleConfig.botUsername,
    BALE_WEBHOOK_SECRET: baleConfig.webhookSecret,
    BALE_WEBHOOK_URL: `https://api.example.com/api/v1/messaging/bale/webhook/${baleConfig.webhookSecret}`,
    BALE_SAFIR_ENABLED: false,
    SMS_ENABLED: false,
    ...overrides,
  }
}

describe('messaging set-webhook CLI', () => {
  it('defaults to telegram unless provider is bale', () => {
    expect(parseProviderArg([])).toBe('telegram')
    expect(parseProviderArg(['--provider=telegram'])).toBe('telegram')
    expect(parseProviderArg(['--provider', 'bale'])).toBe('bale')
    expect(() => parseProviderArg(['--provider='])).toThrow(/Missing provider/)
    expect(() => parseProviderArg(['--provider'])).toThrow(/Missing provider/)
    expect(() => parseProviderArg(['--provider=rubika'])).toThrow(/Unsupported provider/)
  })

  it('resolves complete Bale config and refuses incomplete config', () => {
    expect(resolveBaleWebhookInput(env())).toEqual({
      config: baleConfig,
      url: `https://api.example.com/api/v1/messaging/bale/webhook/${baleConfig.webhookSecret}`,
    })

    expect(resolveBaleWebhookInput(env({ BALE_ENABLED: false }))).toBeNull()
    expect(resolveBaleWebhookInput(env({ BALE_WEBHOOK_URL: undefined }))).toBeNull()
  })

  it('requires Bale webhook URL to be HTTPS on a supported port with the secret path segment', () => {
    expect(() =>
      assertBaleWebhookUrl(
        'https://api.example.com/api/v1/messaging/bale/webhook/secret-123',
        'secret-123',
      ),
    ).not.toThrow()
    expect(() =>
      assertBaleWebhookUrl(
        'https://api.example.com:88/api/v1/messaging/bale/webhook/secret-123',
        'secret-123',
      ),
    ).not.toThrow()

    expect(() =>
      assertBaleWebhookUrl(
        'http://api.example.com/api/v1/messaging/bale/webhook/secret-123',
        'secret-123',
      ),
    ).toThrow(/HTTPS/)
    expect(() =>
      assertBaleWebhookUrl(
        'https://api.example.com:8443/api/v1/messaging/bale/webhook/secret-123',
        'secret-123',
      ),
    ).toThrow(/443 and 88/)
    expect(() =>
      assertBaleWebhookUrl(
        'https://api.example.com/api/v1/messaging/bale/webhook/wrong',
        'secret-123',
      ),
    ).toThrow(/path segment/)
  })

  it('builds the expected Bale setWebhook endpoint and payload', () => {
    expect(
      buildBaleSetWebhookRequest({
        config: baleConfig,
        url: 'https://api.example.com/api/v1/messaging/bale/webhook/secret-123',
      }),
    ).toEqual({
      endpoint: 'https://tapi.bale.ai/botbale-token/setWebhook',
      payload: {
        url: 'https://api.example.com/api/v1/messaging/bale/webhook/secret-123',
      },
    })
  })

  it('posts the Bale setWebhook payload as JSON', async () => {
    const fetchFn = vi.fn(async () => Response.json({ ok: true, result: true }))

    await setBaleWebhook(
      {
        config: baleConfig,
        url: 'https://api.example.com/api/v1/messaging/bale/webhook/secret-123',
      },
      fetchFn,
    )

    expect(fetchFn).toHaveBeenCalledWith('https://tapi.bale.ai/botbale-token/setWebhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://api.example.com/api/v1/messaging/bale/webhook/secret-123',
      }),
    })
  })

  it('surfaces Bale setWebhook API errors', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ ok: false, description: 'bad url', error_code: 400 }),
    )

    await expect(
      setBaleWebhook(
        {
          config: baleConfig,
          url: 'https://api.example.com/api/v1/messaging/bale/webhook/secret-123',
        },
        fetchFn,
      ),
    ).rejects.toThrow('bad url (error_code 400)')
  })
})
