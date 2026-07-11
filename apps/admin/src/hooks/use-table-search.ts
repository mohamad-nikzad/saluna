import { useNavigate, useSearch } from '@tanstack/react-router'

import {
  compactTableSearch,
  DEFAULT_TABLE_SEARCH,
  normalizePageSize,
  type PageSizeOption,
  type TableSearch,
} from '#/lib/admin-search-schemas'

export type TableSearchRouteId =
  | '/_admin/salons/'
  | '/_admin/catalog-presets'
  | '/_admin/settings'

export type TableSearchRouteTo = '/salons' | '/catalog-presets' | '/settings'

const TABLE_ROUTE_TO: Record<TableSearchRouteId, TableSearchRouteTo> = {
  '/_admin/salons/': '/salons',
  '/_admin/catalog-presets': '/catalog-presets',
  '/_admin/settings': '/settings',
}

export function useTableSearch(
  from: TableSearchRouteId,
  defaultPageSize: PageSizeOption = DEFAULT_TABLE_SEARCH.pageSize,
) {
  const search = useSearch({ from }) as TableSearch
  const navigate = useNavigate({ from: TABLE_ROUTE_TO[from] })
  const defaults = {
    page: DEFAULT_TABLE_SEARCH.page,
    pageSize: defaultPageSize,
  }

  const state = {
    page: search.page ?? defaults.page,
    pageSize: search.pageSize ?? defaults.pageSize,
    query: search.q ?? '',
  }

  const setState = (next: Partial<typeof state>) => {
    navigate({
      search: (prev) => {
        const current = prev as TableSearch
        return compactTableSearch(
          {
            page: next.page ?? current.page ?? defaults.page,
            pageSize: normalizePageSize(
              next.pageSize ?? current.pageSize ?? defaults.pageSize,
              defaults.pageSize,
            ),
            q: next.query !== undefined ? next.query || undefined : current.q,
          },
          defaults,
        )
      },
      replace: true,
    })
  }

  return [state, setState] as const
}
