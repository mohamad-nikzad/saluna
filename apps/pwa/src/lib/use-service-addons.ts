import { useQuery } from '@tanstack/react-query'
import { serviceAddonsForServiceQueryOptions } from '#/lib/services-queries'

export function useServiceAddons(serviceId: string, enabled: boolean) {
  return useQuery({
    ...serviceAddonsForServiceQueryOptions(serviceId),
    enabled: enabled && !!serviceId,
  })
}
