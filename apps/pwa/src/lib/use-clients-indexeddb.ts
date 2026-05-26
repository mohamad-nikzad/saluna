import { useEffect, useMemo, useState } from 'react'
import type { Client } from '@repo/salon-core/types'
import {
  useManagerDataClient,
  useManagerOfflineDataEpoch,
} from '#/lib/manager-data-client'

export function useClientsListIndexedDbSources(
  enabled: boolean,
  isOnline: boolean,
  live: { clients: Client[] } | undefined,
) {
  const client = useManagerDataClient()
  const offlineDataEpoch = useManagerOfflineDataEpoch()
  const [repo, setRepo] = useState<{
    loaded: boolean
    clients: Client[]
    listUpdatedAt: string | null
  }>({ loaded: false, clients: [], listUpdatedAt: null })

  useEffect(() => {
    if (!enabled || !client) {
      setRepo({ loaded: false, clients: [], listUpdatedAt: null })
      return
    }

    let cancelled = false
    void (async () => {
      if (isOnline && live?.clients !== undefined) {
        await client.clients.hydrateListFromServer(live.clients)
      }
      const [rows, ts] = await Promise.all([
        client.clients.list(),
        client.clients.listLastSyncedAt(),
      ])
      if (cancelled) return
      setRepo({ loaded: true, clients: rows, listUpdatedAt: ts })
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, client, isOnline, live, offlineDataEpoch])

  return useMemo(() => {
    if (!enabled || !client) {
      return {
        data: live,
        snapshotUpdatedAt: null as string | null,
        hasSnapshot: false,
        idbLoading: false,
      }
    }

    if (!repo.loaded) {
      if (isOnline) {
        return {
          data: live,
          snapshotUpdatedAt: null as string | null,
          hasSnapshot: false,
          idbLoading: true,
        }
      }
      return {
        data: undefined,
        snapshotUpdatedAt: null as string | null,
        hasSnapshot: false,
        idbLoading: true,
      }
    }

    return {
      data: { clients: repo.clients },
      snapshotUpdatedAt: repo.listUpdatedAt,
      hasSnapshot: true,
      idbLoading: false,
    }
  }, [enabled, client, isOnline, live, repo])
}
