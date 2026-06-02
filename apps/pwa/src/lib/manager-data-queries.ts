import { useQuery } from '@tanstack/react-query'
import type {
  Service,
  ServiceAddon,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'

import {
  comboComponentsQueryKey,
  managerAddonsQueryKey,
  managerBusinessSettingsQueryKey,
  managerServiceCatalogQueryKey,
  managerServicesQueryKey,
  managerStaffQueryKey,
  staffScheduleBundleQueryKey,
} from '#/lib/query-keys'
import { useManagerDataClient } from '#/lib/manager-data-client'
import { useManagerCollection } from '#/lib/use-manager-collection'

export type ManagerServiceCatalog = {
  categories: ServiceCategory[]
  families: ServiceFamily[]
  services: Service[]
}

export function useManagerStaffQuery(enabled = true) {
  return useManagerCollection(
    managerStaffQueryKey,
    (dc) => dc.staff.list(),
    (dc, sync) => dc.staff.subscribe(sync),
    enabled,
  )
}

export function useManagerServicesQuery(enabled = true) {
  return useManagerCollection(
    managerServicesQueryKey,
    (dc) => dc.services.list(),
    (dc, sync) => dc.services.subscribe(sync),
    enabled,
  )
}

export function useManagerServiceCatalogQuery(enabled = true) {
  return useManagerCollection(
    managerServiceCatalogQueryKey,
    async (dc): Promise<ManagerServiceCatalog> => {
      const [categories, families, services] = await Promise.all([
        dc.services.categories.list({ includeInactive: true }),
        dc.services.families.list({ includeInactive: true }),
        dc.services.list({ includeInactive: true }),
      ])
      return { categories, families, services }
    },
    (dc, sync) =>
      dc.services.subscribe((services) =>
        sync((current) => (current ? { ...current, services } : current)),
      ),
    enabled,
  )
}

export function useManagerAddonsQuery(enabled = true) {
  const dc = useManagerDataClient()

  return useQuery({
    queryKey: managerAddonsQueryKey,
    queryFn: (): Promise<ServiceAddon[]> =>
      dc!.services.addons.list({ includeInactive: true }),
    enabled: enabled && !!dc,
  })
}

export function useManagerBusinessSettingsQuery(enabled = true) {
  return useManagerCollection(
    managerBusinessSettingsQueryKey,
    (dc) => dc.businessSettings.get(),
    (dc, sync) => dc.businessSettings.subscribe(sync),
    enabled,
  )
}

export function useStaffScheduleBundleQuery(
  staffId: string | undefined,
  open: boolean,
) {
  const dc = useManagerDataClient()

  return useQuery({
    queryKey: staffScheduleBundleQueryKey(staffId ?? ''),
    queryFn: () => dc!.staff.getScheduleBundle(staffId!),
    enabled: open && !!staffId && !!dc,
  })
}

export function useComboComponentsQuery(
  serviceId: string | undefined,
  open: boolean,
  isCombo: boolean,
) {
  const dc = useManagerDataClient()

  return useQuery({
    queryKey: comboComponentsQueryKey(serviceId ?? ''),
    queryFn: () => dc!.services.comboComponents.get(serviceId!),
    enabled: open && !!serviceId && isCombo && !!dc,
  })
}
