import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTelegramProvider, initTelegramMessaging } from './telegram'

const fetchMock = vi.fn()

const testConfig = {
  botToken: 'test-token',
  botUsername: 'TestBot',
  webhookSecret: 'shh',
}

beforeEach(() => {
  initTelegramMessaging(() => testConfig)
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReset()
})

afterEach(() => {
  initTelegramMessaging(() => null)
})

describe('createTelegramProvider().send', () => {
  it('skips when config is not available', async () => {
    const provider = createTelegramProvider(() => null)
    const result = await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
    })
    expect(result.status).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to sendMessage and returns sent with providerMessageId', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 })
    )
    const provider = createTelegramProvider(() => testConfig)
    const result = await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
    })
    expect(result.status).toBe('sent')
    expect(result.providerMessageId).toBe('7')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://api.telegram.org/bottest-token/sendMessage')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.chat_id).toBe('42')
    expect(body.parse_mode).toBe('HTML')
    expect(body.text).toContain('<b>T</b>')
  })

  it('returns failed on HTTP error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error_code: 400, description: 'bad' }), {
        status: 400,
      })
    )
    const provider = createTelegramProvider(() => testConfig)
    const result = await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
    })
    expect(result.status).toBe('failed')
    expect(result.error).toContain('bad')
  })

  it('serializes inline keyboard with callback_data when buttons are provided', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 })
    )
    const provider = createTelegramProvider(() => testConfig)
    await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
      buttons: [[{ label: 'Approve', data: 'approve:r1' }]],
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    )
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[{ text: 'Approve', callback_data: 'approve:r1' }]],
    })
  })

  it('serializes inline keyboard with url when url buttons are provided', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 })
    )
    const provider = createTelegramProvider(() => testConfig)
    await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
      buttons: [[{ label: 'Open app', url: 'https://app.example/requests/1' }]],
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    )
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[{ text: 'Open app', url: 'https://app.example/requests/1' }]],
    })
  })

  it('escapes HTML in title and body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 })
    )
    const provider = createTelegramProvider(() => testConfig)
    await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: '<x>',
      body: 'a & b',
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    )
    expect(body.text).toContain('&lt;x&gt;')
    expect(body.text).toContain('a &amp; b')
  })
})
