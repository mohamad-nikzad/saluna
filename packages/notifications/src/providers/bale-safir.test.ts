import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildBaleSafirSendMessageRequest,
  initBaleSafir,
  mapBaleSafirErrorCode,
  normalizeBaleSafirPhone,
  sendBaleSafirMessage,
  setBaleSafirFetchForTests,
} from './bale-safir'

const fetchMock = vi.fn()

const testConfig = {
  apiAccessKey: 'access-key',
  botId: '123456',
}

beforeEach(() => {
  initBaleSafir(() => testConfig)
  setBaleSafirFetchForTests(fetchMock as unknown as typeof globalThis.fetch)
  fetchMock.mockReset()
})

afterEach(() => {
  initBaleSafir(() => null)
  setBaleSafirFetchForTests(undefined)
})

describe('normalizeBaleSafirPhone()', () => {
  it('normalizes common Iranian phone forms to Safir 98 format', () => {
    expect(normalizeBaleSafirPhone('09123456789')).toBe('989123456789')
    expect(normalizeBaleSafirPhone('9123456789')).toBe('989123456789')
    expect(normalizeBaleSafirPhone('+989123456789')).toBe('989123456789')
    expect(normalizeBaleSafirPhone('989123456789')).toBe('989123456789')
    expect(normalizeBaleSafirPhone('0912 345 6789')).toBe('989123456789')
  })

  it('rejects invalid or non-Iranian mobile numbers', () => {
    expect(normalizeBaleSafirPhone('02112345678')).toBeNull()
    expect(normalizeBaleSafirPhone('98912345')).toBeNull()
    expect(normalizeBaleSafirPhone('+12025550123')).toBeNull()
  })
})

describe('mapBaleSafirErrorCode()', () => {
  it('maps documented Safir errors to local error names', () => {
    expect(mapBaleSafirErrorCode(8)).toBe('invalid_phone')
    expect(mapBaleSafirErrorCode(17)).toBe('not_bale_user')
    expect(mapBaleSafirErrorCode(3)).toBe('rate_limited')
    expect(mapBaleSafirErrorCode(20)).toBe('payment_required')
    expect(mapBaleSafirErrorCode(2)).toBe('safir_send_error')
    expect(mapBaleSafirErrorCode(undefined)).toBe('safir_send_error')
  })
})

describe('buildBaleSafirSendMessageRequest()', () => {
  it('builds the Safir send_message request with supported inline buttons', () => {
    const request = buildBaleSafirSendMessageRequest({
      config: testConfig,
      requestId: 'staff-appointment-a1',
      phoneNumber: '989123456789',
      text: 'نوبت جدید',
      buttons: [
        [
          { label: 'Open', url: 'https://app.example/appointment/a1' },
          { label: 'Mini', webAppUrl: 'https://app.example/mini' },
          { label: 'Copy', copyText: 'A1' },
        ],
        [
          { label: 'Unsafe', url: 'http://localhost:3000' },
          { label: 'Empty copy', copyText: '' },
        ],
      ],
    })

    expect(request.endpoint).toBe('https://safir.bale.ai/api/v3/send_message')
    expect(request.init).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-access-key': 'access-key',
      },
    })
    expect(JSON.parse(request.init.body as string)).toEqual({
      request_id: 'staff-appointment-a1',
      bot_id: 123456,
      phone_number: '989123456789',
      message_data: {
        message: {
          text: 'نوبت جدید',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Open', url: 'https://app.example/appointment/a1' },
                { text: 'Mini', web_app: { url: 'https://app.example/mini' } },
                { text: 'Copy', copy_text: 'A1' },
              ],
            ],
          },
        },
      },
    })
  })
})

describe('sendBaleSafirMessage()', () => {
  it('skips when Safir is not configured', async () => {
    initBaleSafir(() => null)

    const result = await sendBaleSafirMessage({
      phone: '09123456789',
      text: 'message',
      requestId: 'r1',
    })

    expect(result).toEqual({ status: 'skipped', error: 'safir_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails invalid phones before calling Safir', async () => {
    const result = await sendBaleSafirMessage({
      phone: '02112345678',
      text: 'message',
      requestId: 'r1',
    })

    expect(result).toEqual({
      status: 'failed',
      error: 'invalid_phone',
      phone: null,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the Safir message and returns the provider message id', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        message_id: '523e6875-7c41-491b-8460-04b33039d7fc',
        error_data: null,
      }),
    )

    const result = await sendBaleSafirMessage({
      phone: '+989123456789',
      text: 'message',
      requestId: 'r1',
    })

    expect(result).toEqual({
      status: 'sent',
      providerMessageId: '523e6875-7c41-491b-8460-04b33039d7fc',
      phone: '989123456789',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps Safir error_data to local failed delivery errors', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        message_id: null,
        error_data: [
          {
            phone_number: '989123456789',
            code: 17,
            description: 'NotBaleUser',
          },
        ],
      }),
    )

    const result = await sendBaleSafirMessage({
      phone: '09123456789',
      text: 'message',
      requestId: 'r1',
    })

    expect(result).toEqual({
      status: 'failed',
      error: 'not_bale_user',
      phone: '989123456789',
    })
  })

  it('returns a normalized failed delivery for non-JSON HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('upstream down', { status: 502 }),
    )

    const result = await sendBaleSafirMessage({
      phone: '09123456789',
      text: 'message',
      requestId: 'r1',
    })

    expect(result).toEqual({
      status: 'failed',
      error: 'safir_http_502',
      phone: '989123456789',
    })
  })
})
