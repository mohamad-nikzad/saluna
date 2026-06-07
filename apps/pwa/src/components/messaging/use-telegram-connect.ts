import type { QueryKey } from '@tanstack/react-query'

import { useMessagingConnect } from './use-messaging-connect'

export function useTelegramConnect(options?: {
  /** Custom error message fallback */
  errorMessage?: string
  /** Query keys to invalidate after opening deep link (with optional delay) */
  invalidateQueries?: ReadonlyArray<QueryKey>
  invalidateDelayMs?: number
  skipErrorToast?: boolean
  skipSuccessToast?: boolean
}) {
  return useMessagingConnect('telegram', {
    errorMessage: 'اتصال تلگرام انجام نشد',
    ...options,
  })
}
