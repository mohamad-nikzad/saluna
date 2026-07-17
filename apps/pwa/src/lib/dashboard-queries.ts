import { queryOptions } from '@tanstack/react-query'
import { getApiV1Dashboard } from '@repo/api-client/sdk'
import { getApiV1DashboardQueryKey } from '@repo/api-client/query'
import type { DashboardData } from '@repo/api-client/types'

import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'

export { getApiV1DashboardQueryKey }
export type { DashboardData }

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: [
      ...getApiV1DashboardQueryKey(),
      { schema: 'financial-summary-v1' },
    ] as const,
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    queryFn: async ({ signal }): Promise<DashboardData> => {
      const { data } = await getApiV1Dashboard({
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}
