import { useQuery } from '@tanstack/react-query'

import { salonClosuresQueryOptions } from '#/lib/settings-queries'

export function useSalonUnavailableDates() {
  return useQuery(salonClosuresQueryOptions()).data ?? []
}
