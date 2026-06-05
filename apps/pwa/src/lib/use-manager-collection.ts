import { useEffect } from 'react'
import {
  useQuery,
  useQueryClient
  
  
} from '@tanstack/react-query'
import type {QueryKey, UseQueryResult} from '@tanstack/react-query';
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
  staleTime?: number,
): UseQueryResult<T> {
  const dc = useManagerDataClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey,
    queryFn: () => list(dc!),
    enabled: enabled && !!dc,
    staleTime,
  })

  useEffect(() => {
    if (!dc || !subscribe) return
    return subscribe(dc, (update) => {
      queryClient.setQueryData<T>(queryKey, (prev) => {
        if (typeof update === 'function') {
          return (update as (current: T | undefined) => T | undefined)(prev)
        }
        return update
      })
    })
    // subscribe is stable per entity hook; omit from deps like the prior hooks.
  }, [dc, queryClient, queryKey])

  return query
}
