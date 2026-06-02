import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { createDataClient } from '@repo/data-client'
import type { DataClient } from '@repo/data-client'

import { env } from '#/env'

type ManagerDataContextValue = {
  client: DataClient | null
  offlineDataEpoch: number
  bumpOfflineData: () => void
}

const ManagerDataClientContext = createContext<ManagerDataContextValue | null>(
  null,
)

export function ManagerDataClientProvider({
  children,
}: {
  children: ReactNode
}) {
  const [client] = useState<DataClient | null>(() =>
    typeof window === 'undefined'
      ? null
      : createDataClient({
          persistence: 'indexeddb',
          basePath: env.apiBaseUrl,
          apiPrefix: '/api/v1',
        }),
  )
  const [offlineDataEpoch, setOfflineDataEpoch] = useState(0)

  const bumpOfflineData = useCallback(() => {
    setOfflineDataEpoch((n) => n + 1)
  }, [])

  const ctx = useMemo(
    () => ({ client, offlineDataEpoch, bumpOfflineData }),
    [client, offlineDataEpoch, bumpOfflineData],
  )

  useEffect(() => {
    if (!client) return
    const run = () => {
      if (window.location.pathname.startsWith('/onboarding')) return
      void client.sync.processPending()
    }
    const onOnline = () => run()
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    const onFocus = () => run()
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    run()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [client])

  return (
    <ManagerDataClientContext.Provider value={ctx}>
      {children}
    </ManagerDataClientContext.Provider>
  )
}

export function useManagerDataClient(): DataClient | null {
  return useContext(ManagerDataClientContext)?.client ?? null
}

export function useManagerOfflineDataEpoch(): number {
  return useContext(ManagerDataClientContext)?.offlineDataEpoch ?? 0
}

export function useBumpOfflineData(): () => void {
  return useContext(ManagerDataClientContext)?.bumpOfflineData ?? (() => {})
}
