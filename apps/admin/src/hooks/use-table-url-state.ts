import { useCallback, useMemo, useState } from 'react'

type TableSearch = {
  page?: number
  pageSize?: number
  q?: string
  sort?: string
}

export function useTableUrlState(defaultPageSize = 20) {
  const [search, setSearch] = useState<TableSearch>(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      page: Number(params.get('page') ?? 1),
      pageSize: Number(params.get('pageSize') ?? defaultPageSize),
      q: params.get('q') ?? undefined,
      sort: params.get('sort') ?? undefined,
    }
  })

  const state = useMemo(
    () => ({
      page: Number(search.page ?? 1),
      pageSize: Number(search.pageSize ?? defaultPageSize),
      query: search.q ?? '',
      sort: search.sort ?? '',
    }),
    [defaultPageSize, search.page, search.pageSize, search.q, search.sort],
  )

  const setState = useCallback(
    (next: Partial<typeof state>) => {
      const updated = {
        page: next.page ?? state.page,
        pageSize: next.pageSize ?? state.pageSize,
        q: (next.query ?? state.query) || undefined,
        sort: (next.sort ?? state.sort) || undefined,
      }
      const params = new URLSearchParams(window.location.search)

      for (const [key, value] of Object.entries(updated)) {
        if (value === undefined || value === '') {
          params.delete(key)
        } else {
          params.set(key, String(value))
        }
      }

      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
      window.history.replaceState(null, '', nextUrl)
      setSearch(updated)
    },
    [state.page, state.pageSize, state.query, state.sort],
  )

  return [state, setState] as const
}
