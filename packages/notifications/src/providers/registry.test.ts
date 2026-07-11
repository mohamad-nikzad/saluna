import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetMessagingProviderRegistry,
  getMessagingProvider,
  listConfiguredMessagingProviders,
  listMessagingProviders,
  registerMessagingProvider,
  unregisterMessagingProvider,
} from './registry'
import type { MessagingProvider } from './types'

function fakeProvider(
  overrides: Partial<MessagingProvider> = {},
): MessagingProvider {
  return {
    id: 'telegram',
    displayName: 'Telegram',
    supportsInlineButtons: true,
    supportsInbound: true,
    isConfigured: () => true,
    buildAccountLinkUrl: () => null,
    send: async () => ({ status: 'sent', providerMessageId: 'm1' }),
    ...overrides,
  }
}

describe('messaging provider registry', () => {
  afterEach(() => _resetMessagingProviderRegistry())

  it('registers and retrieves providers by id', () => {
    const p = fakeProvider()
    registerMessagingProvider(p)
    expect(getMessagingProvider('telegram')).toBe(p)
    expect(listMessagingProviders()).toEqual([p])
  })

  it('lists only configured providers', () => {
    const yes = fakeProvider({ id: 'telegram', isConfigured: () => true })
    const no = fakeProvider({ id: 'bale', isConfigured: () => false })
    registerMessagingProvider(yes)
    registerMessagingProvider(no)
    expect(listConfiguredMessagingProviders()).toEqual([yes])
  })

  it('unregister removes the entry', () => {
    registerMessagingProvider(fakeProvider())
    unregisterMessagingProvider('telegram')
    expect(getMessagingProvider('telegram')).toBeUndefined()
  })
})
