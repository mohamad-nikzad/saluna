import { useEffect } from 'react'
import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { DataClient } from '@repo/data-client'

import { useManagerDataClient } from '#/lib/manager-data-client'

export type ManagerCollectionSync<T> =
  | T
  | ((prev: T | undefined) => T | undefined)

export type ManagerCollectionSubscribe<T> = (
  dataClient: DataClient,
  sync: (update: ManagerCollectionSync<T>) => void,
) => void | (() => void)

// Deep helper: useQuery + data-client subscribe → setQueryData in one place.
export function useManagerCollection<T>(
  queryKey: QueryKey,
  list: (dataClient: DataClient) => Promise<T>,
  subscribe?: ManagerCollectionSubscribe<T>,
  enabled = true,
): UseQueryResult<T> {
  const dc = useManagerDataClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey,
    queryFn: () => list(dc!),
    enabled: enabled && !!dc,
  })

  useEffect(() => {
    if (!dc || !subscribe) return
    return subscribe(dc, (update) => {
      queryClient.setQueryData(queryKey, (prev) =>
        typeof update === 'function' ? update(prev) : update,
      )
    })
    // subscribe is stable per entity hook; omit from deps like the prior hooks.
  }, [dc, queryClient, queryKey])

  return query
}
