import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TodayData } from '@repo/salon-core/types'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'

import { api } from '#/lib/api-client'
import { useManagerDataClient } from '#/lib/manager-data-client'
import {
  useManagerServicesQuery,
} from '#/lib/manager-data-queries'
import { clientsListQueryOptions } from '#/lib/clients-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'
import { useNetworkStatus } from '#/lib/network-status'
import { firstNameOf } from '#/lib/today-view-model'
import { useManagerTodayIndexedDbSources } from '#/lib/use-manager-today-indexeddb'
import {
  ManagerTodayContext
  
} from '#/components/today/manager-today-context'
import type {ManagerTodayContextValue} from '#/components/today/manager-today-context';
import {
  pickTodayDisplayData,
  todayLoadingWithoutData,
} from '#/components/today/today-data'

export function ManagerTodayProvider({
  userName,
  children,
}: {
  userName: string
  children: React.ReactNode
}) {
  const dc = useManagerDataClient()
  const isOnline = useNetworkStatus()
  const initialToday = useMemo(() => salonTodayYmd(), [])
  const [date, setDate] = useState(initialToday)

  const todayQuery = useQuery<TodayData>({
    queryKey: ['today', date],
    queryFn: ({ signal }) => api.today.get(date, { signal }),
    enabled: true,
  })

  const staffQuery = useQuery(staffListQueryOptions())
  const servicesQuery = useManagerServicesQuery(Boolean(dc))
  const clientsQuery = useQuery(clientsListQueryOptions())

  const idb = useManagerTodayIndexedDbSources(
    true,
    isOnline,
    date,
    todayQuery.data,
    staffQuery.data,
    servicesQuery.data,
    clientsQuery.data,
  )

  const displayData = pickTodayDisplayData(idb.todayData, todayQuery.data)

  const value = useMemo<ManagerTodayContextValue>(
    () => ({
      state: {
        date,
        data: displayData,
        isLoading: todayLoadingWithoutData(
          todayQuery.isLoading,
          idb.idbLoading,
          displayData,
        ),
        error: todayQuery.error,
        snapshotUpdatedAt: idb.snapshotUpdatedAt,
        hasSnapshot: idb.hasSnapshot,
        isOnline,
        staff: idb.staff,
        services: idb.services,
        clients: idb.clients,
        managerName: firstNameOf(userName),
      },
      actions: {
        setDate,
        mutateToday: () => void todayQuery.refetch(),
        onRefreshResources: () => {
          void staffQuery.refetch()
          void servicesQuery.refetch()
          void clientsQuery.refetch()
        },
      },
    }),
    [
      date,
      displayData,
      todayQuery.isLoading,
      todayQuery.error,
      todayQuery.refetch,
      idb,
      isOnline,
      userName,
      staffQuery.refetch,
      servicesQuery.refetch,
      clientsQuery.refetch,
    ],
  )

  return (
    <ManagerTodayContext value={value}>{children}</ManagerTodayContext>
  )
}
