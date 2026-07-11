import type { MessagingProvider, MessagingProviderId } from './types'

const providers = new Map<MessagingProviderId, MessagingProvider>()

export function registerMessagingProvider(provider: MessagingProvider): void {
  providers.set(provider.id, provider)
}

export function unregisterMessagingProvider(id: MessagingProviderId): void {
  providers.delete(id)
}

export function getMessagingProvider(
  id: MessagingProviderId,
): MessagingProvider | undefined {
  return providers.get(id)
}

export function listMessagingProviders(): MessagingProvider[] {
  return Array.from(providers.values())
}

export function listConfiguredMessagingProviders(): MessagingProvider[] {
  return listMessagingProviders().filter((p) => p.isConfigured())
}

/** Test-only: clears the registry. */
export function _resetMessagingProviderRegistry(): void {
  providers.clear()
}
