import { useQuery } from '@tanstack/react-query'

import { pendingAppointmentRequestsQueryOptions } from '#/lib/appointment-requests-queries'
import { supportTicketSummaryQueryOptions } from '#/lib/support-ticket-queries'

export function useBottomNavBadges(enabled: boolean) {
  const { data: pendingData } = useQuery({
    ...pendingAppointmentRequestsQueryOptions(),
    enabled,
    refetchInterval: 60_000,
  })
  const { data: supportSummary } = useQuery({
    ...supportTicketSummaryQueryOptions(),
    enabled,
  })

  return {
    pendingCount: pendingData?.requests.length ?? 0,
    supportUnreadCount: supportSummary?.unreadCount ?? 0,
  }
}
