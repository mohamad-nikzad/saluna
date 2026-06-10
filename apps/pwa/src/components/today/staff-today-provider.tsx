import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'

import { todayQueryOptions } from '#/lib/today-queries'
import { firstNameOf } from '#/lib/today-view-model'
import { StaffTodayContext } from '#/components/today/staff-today-context'
import type { StaffTodayContextValue } from '#/components/today/staff-today-context'

export function StaffTodayProvider({
  userName,
  enabled,
  children,
}: {
  userName: string
  /** Mirrors route gate: only staff role fetches today API. */
  enabled: boolean
  children: React.ReactNode
}) {
  const todayDate = useMemo(() => salonTodayYmd(), [])
  const tomorrowDate = useMemo(() => addDaysYmd(todayDate, 1), [todayDate])

  const todayQuery = useQuery({
    ...todayQueryOptions(todayDate),
    enabled,
  })

  const tomorrowQuery = useQuery({
    ...todayQueryOptions(tomorrowDate),
    enabled,
  })

  const value = useMemo<StaffTodayContextValue>(
    () => ({
      state: {
        todayDate,
        tomorrowDate,
        todayData: todayQuery.data,
        tomorrowData: tomorrowQuery.data,
        todayLoading: todayQuery.isLoading && !todayQuery.data,
        tomorrowLoading: tomorrowQuery.isLoading && !tomorrowQuery.data,
        todayError: todayQuery.error,
        tomorrowError: tomorrowQuery.error,
        staffName: firstNameOf(userName),
      },
      actions: {
        mutateToday: () => void todayQuery.refetch(),
        mutateTomorrow: () => void tomorrowQuery.refetch(),
      },
    }),
    [
      todayDate,
      tomorrowDate,
      todayQuery.data,
      tomorrowQuery.data,
      todayQuery.isLoading,
      tomorrowQuery.isLoading,
      todayQuery.error,
      tomorrowQuery.error,
      todayQuery.refetch,
      tomorrowQuery.refetch,
      userName,
    ],
  )

  return <StaffTodayContext value={value}>{children}</StaffTodayContext>
}
