import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'

import { clientsListQueryOptions } from '#/lib/clients-queries'
import { servicesListQueryOptions } from '#/lib/services-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'
import { todayQueryOptions } from '#/lib/today-queries'
import { firstNameOf } from '#/lib/today-view-model'
import { ManagerTodayContext } from '#/components/today/manager-today-context'
import type { ManagerTodayContextValue } from '#/components/today/manager-today-context'

export function ManagerTodayProvider({
  userName,
  children,
}: {
  userName: string
  children: React.ReactNode
}) {
  const [date, setDate] = useState(() => salonTodayYmd())

  const todayQuery = useQuery(todayQueryOptions(date))
  const staffQuery = useQuery(staffListQueryOptions())
  const servicesQuery = useQuery(servicesListQueryOptions())
  const clientsQuery = useQuery(clientsListQueryOptions())

  const value = useMemo<ManagerTodayContextValue>(
    () => ({
      state: {
        date,
        data: todayQuery.data,
        isLoading: todayQuery.isLoading && !todayQuery.data,
        error: todayQuery.error,
        staff: staffQuery.data ?? [],
        services: servicesQuery.data ?? [],
        clients: clientsQuery.data ?? [],
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
      todayQuery.data,
      todayQuery.isLoading,
      todayQuery.error,
      todayQuery.refetch,
      staffQuery.data,
      servicesQuery.data,
      clientsQuery.data,
      staffQuery.refetch,
      servicesQuery.refetch,
      clientsQuery.refetch,
      userName,
    ],
  )

  return <ManagerTodayContext value={value}>{children}</ManagerTodayContext>
}
