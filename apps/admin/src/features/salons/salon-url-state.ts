import { useNavigate, useSearch } from '@tanstack/react-router'

import {
  compactSalonDetailSearch,
  SALON_DETAIL_SECTIONS,
  SALON_OPS_TABS,
  type SalonDetailSearch,
  type SalonDetailSection,
  type SalonOpsTab,
} from '#/lib/admin-search-schemas'

export {
  SALON_DETAIL_SECTIONS,
  SALON_OPS_TABS,
  type SalonDetailSection,
  type SalonOpsTab,
}

export function useSalonDetailUrlState() {
  const search = useSearch({
    from: '/_admin/salons/$salonId',
  }) as SalonDetailSearch
  const navigate = useNavigate({ from: '/salons/$salonId' })

  const tab = search.tab ?? 'overview'
  const subtab = search.subtab ?? 'clients'

  const setTab = (nextTab: SalonDetailSection) => {
    navigate({
      search: () => compactSalonDetailSearch({ tab: nextTab, subtab }),
      replace: true,
    })
  }

  const setSubtab = (nextSubtab: SalonOpsTab) => {
    navigate({
      search: () =>
        compactSalonDetailSearch({ tab: 'operations', subtab: nextSubtab }),
      replace: true,
    })
  }

  return { tab, subtab, setTab, setSubtab }
}
