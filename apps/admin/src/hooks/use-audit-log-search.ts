import { useNavigate, useSearch } from '@tanstack/react-router'

import {
  compactAuditLogSearch,
  DEFAULT_TABLE_SEARCH,
  normalizePageSize,
  type AuditLogSearch,
  type PageSizeOption,
} from '#/lib/admin-search-schemas'

export type AuditLogUrlState = {
  page: number
  pageSize: PageSizeOption
  search: string
  action: string
  targetType: string
  targetId: string
  salonId: string
}

export function useAuditLogSearch(
  defaultPageSize: PageSizeOption = DEFAULT_TABLE_SEARCH.pageSize,
) {
  const search = useSearch({ from: '/_admin/audit-log' }) as AuditLogSearch
  const navigate = useNavigate({ from: '/audit-log' })
  const defaults = {
    page: DEFAULT_TABLE_SEARCH.page,
    pageSize: defaultPageSize,
  }

  const state: AuditLogUrlState = {
    page: search.page ?? defaults.page,
    pageSize: search.pageSize ?? defaults.pageSize,
    search: search.q ?? '',
    action: search.action ?? '',
    targetType: search.targetType ?? '',
    targetId: search.targetId ?? '',
    salonId: search.salonId ?? '',
  }

  const setState = (next: Partial<AuditLogUrlState>) => {
    navigate({
      search: (prev) => {
        const current = prev as AuditLogSearch
        const updated: Partial<AuditLogSearch> = {
          page: next.page ?? current.page ?? defaults.page,
          pageSize: normalizePageSize(
            next.pageSize ?? current.pageSize ?? defaults.pageSize,
            defaults.pageSize,
          ),
          q: next.search !== undefined ? next.search || undefined : current.q,
          action:
            next.action !== undefined
              ? next.action || undefined
              : current.action,
          targetType:
            next.targetType !== undefined
              ? next.targetType || undefined
              : current.targetType,
          targetId:
            next.targetId !== undefined
              ? next.targetId || undefined
              : current.targetId,
          salonId:
            next.salonId !== undefined
              ? next.salonId || undefined
              : current.salonId,
        }

        return compactAuditLogSearch(updated, defaults)
      },
      replace: true,
    })
  }

  return [state, setState] as const
}
