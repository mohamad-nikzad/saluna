import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createBaleProvider,
  initBaleMessaging,
  renderBaleBotHtml,
  setBaleFetchForTests,
} from './bale'

const fetchMock = vi.fn()

const testConfig = {
  botToken: 'test-token',
  botUsername: 'TestBaleBot',
  webhookSecret: 'shh',
}

beforeEach(() => {
  initBaleMessaging(() => testConfig)
  setBaleFetchForTests(fetchMock as unknown as typeof globalThis.fetch)
  fetchMock.mockReset()
})

describe('renderBaleBotHtml()', () => {
  it('strips bot HTML, decodes entities, and escapes Bale Markdown markers', () => {
    expect(
      renderBaleBotHtml('<b>Spa *VIP*</b>\nService &lt;color&gt; [new]'),
    ).toBe('Spa \\*VIP\\*\nService <color> \\[new\\]')
  })
})

afterEach(() => {
  initBaleMessaging(() => null)
  setBaleFetchForTests(undefined)
})

describe('createBaleProvider()', () => {
  it('builds a Bale deep link when configured', () => {
    const provider = createBaleProvider(() => testConfig)
    expect(provider.buildAccountLinkUrl('link-token')).toBe(
      'https://ble.ir/TestBaleBot?start=link-token',
    )
  })
})

describe('createBaleProvider().send', () => {
  it('skips when config is not available', async () => {
    const provider = createBaleProvider(() => null)
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
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), {
        status: 200,
      }),
    )
    const provider = createBaleProvider(() => testConfig)
    const result = await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
    })
    expect(result.status).toBe('sent')
    expect(result.providerMessageId).toBe('7')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://tapi.bale.ai/bottest-token/sendMessage')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.chat_id).toBe('42')
    expect(body.text).toBe('* T *\nB')
    expect(body.parse_mode).toBeUndefined()
  })

  it('returns failed on Bale ok:false responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, error_code: 400, description: 'bad' }),
        {
          status: 200,
        },
      ),
    )
    const provider = createBaleProvider(() => testConfig)
    const result = await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
    })
    expect(result.status).toBe('failed')
    expect(result.error).toContain('bale_400: bad')
  })

  it('serializes inline keyboard callback data and urls', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      }),
    )
    const provider = createBaleProvider(() => testConfig)
    await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
      buttons: [
        [
          { label: 'Approve', data: 'approve:r1' },
          { label: 'Open', url: 'https://app.example/r1' },
        ],
      ],
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    )
    expect(body.reply_markup).toEqual({
      inline_keyboard: [
        [
          { text: 'Approve', callback_data: 'approve:r1' },
          { text: 'Open', url: 'https://app.example/r1' },
        ],
      ],
    })
  })

  it('omits unsafe url buttons and callback data over Bale byte limits', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      }),
    )
    const provider = createBaleProvider(() => testConfig)
    await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'T',
      body: 'B',
      buttons: [
        [
          { label: 'Valid', data: 'approve:r1' },
          { label: 'Local', url: 'http://localhost:3000/r1' },
          { label: 'Too long', data: 'x'.repeat(65) },
        ],
      ],
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    )
    expect(body.reply_markup).toEqual({
      inline_keyboard: [[{ text: 'Valid', callback_data: 'approve:r1' }]],
    })
  })

  it('escapes Bale Markdown markers in title and body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      }),
    )
    const provider = createBaleProvider(() => testConfig)
    await provider.send({
      notificationId: 'n1',
      externalId: '42',
      title: 'Spa *VIP*',
      body: 'Service _color_ [new]',
    })
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    )
    expect(body.text).toBe('* Spa \\*VIP\\* *\nService \\_color\\_ \\[new\\]')
  })
})
