import {
  managerBusinessSettingsQueryKey,
} from '#/lib/query-keys'
import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'
import { useManagerCollection } from '#/lib/use-manager-collection'

export function useManagerBusinessSettingsQuery(enabled = true) {
  return useManagerCollection(
    managerBusinessSettingsQueryKey,
    (dc) => dc.businessSettings.get(),
    (dc, sync) => dc.businessSettings.subscribe(sync),
    enabled,
    HEAVY_QUERY_STALE_TIME_MS,
  )
}
