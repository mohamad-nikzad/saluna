import { describe, expect, it } from 'vitest'

import {
  buildRequestDeepLink,
  faDigits,
  isolate,
  isTelegramInlineButtonUrl,
  rtl,
} from './format'

describe('buildRequestDeepLink', () => {
  it('builds a /requests?focus= deep link', () => {
    expect(buildRequestDeepLink('https://app.example', 'req-1')).toBe(
      'https://app.example/requests?focus=req-1',
    )
  })

  it('strips a trailing slash from the base', () => {
    expect(buildRequestDeepLink('https://app.example/', 'req-1')).toBe(
      'https://app.example/requests?focus=req-1',
    )
  })
})

describe('isTelegramInlineButtonUrl', () => {
  it('accepts https URLs', () => {
    expect(
      isTelegramInlineButtonUrl('https://app.example/requests?focus=1'),
    ).toBe(true)
  })

  it('rejects http and localhost (Telegram inline keyboard rules)', () => {
    expect(
      isTelegramInlineButtonUrl('http://localhost:3000/requests?focus=1'),
    ).toBe(false)
    expect(isTelegramInlineButtonUrl('http://app.example/requests')).toBe(false)
  })
})

describe('faDigits', () => {
  it('converts Latin digits to Persian digits', () => {
    expect(faDigits('10:30')).toBe('۱۰:۳۰')
    expect(faDigits(42)).toBe('۴۲')
  })

  it('is a no-op on already-Persian input', () => {
    expect(faDigits('۱۲۳')).toBe('۱۲۳')
  })
})

describe('isolate', () => {
  it('wraps the run in FSI…PDI', () => {
    const out = isolate('0912')
    expect(out.startsWith('⁨')).toBe(true)
    expect(out.endsWith('⁩')).toBe(true)
    expect(out).toContain('0912')
  })
})

describe('rtl', () => {
  it('prefixes the line with RLM', () => {
    expect(rtl('سلام').startsWith('‏')).toBe(true)
  })
})
