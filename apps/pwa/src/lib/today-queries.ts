import { queryOptions } from '@tanstack/react-query'
import { getApiV1Today } from '@repo/api-client/sdk'
import { getApiV1TodayQueryKey } from '@repo/api-client/query'
import type { TodayData as GeneratedTodayData } from '@repo/api-client/types'
import type { TodayData } from '@repo/salon-core/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1TodayQueryKey }
export type { TodayData }

function mapTodayData(data: GeneratedTodayData): TodayData {
  return data as unknown as TodayData
}

export function todayQueryOptions(date?: string) {
  return queryOptions({
    queryKey: getApiV1TodayQueryKey(date ? { query: { date } } : undefined),
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<TodayData> => {
      const { data } = await getApiV1Today({
        ...(date ? { query: { date } } : {}),
        signal,
        throwOnError: true,
      })
      return mapTodayData(data)
    },
  })
}
