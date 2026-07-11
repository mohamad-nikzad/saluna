import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import type { ReactNode } from 'react'

import { ErrorPanel } from '#/components/admin/error-panel'
import { ScreenSkeleton } from '#/components/admin/screen-skeleton'
import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import {
  useTableSearch,
  type TableSearchRouteId,
} from '#/hooks/use-table-search'
import { normalizePageSize } from '#/lib/admin-search-schemas'

type RecordRow = Record<string, unknown>

type ListParams = {
  page: number
  pageSize: number
  search?: string
}

type ListResult = {
  items: RecordRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

type AdminListQueryOptions = UseQueryOptions<
  ListResult,
  unknown,
  ListResult,
  readonly unknown[]
>

export function AdminListTable({
  from,
  columns,
  queryOptionsFor,
  hint,
  toolbarActions,
  loadingLabel = 'در حال بارگذاری رکوردها',
  errorMessage = 'بارگذاری رکوردها ناموفق بود.',
}: {
  from: TableSearchRouteId
  columns: ColumnDef<RecordRow>[]
  queryOptionsFor: (params: ListParams) => unknown
  hint?: string
  toolbarActions?: ReactNode
  loadingLabel?: string
  errorMessage?: string
}) {
  const [tableState, setTableState] = useTableSearch(from, 20)
  const pagination: PaginationState = {
    pageIndex: Math.max(tableState.page - 1, 0),
    pageSize: tableState.pageSize,
  }
  const listQuery = useQuery(
    queryOptionsFor({
      page: tableState.page,
      pageSize: tableState.pageSize,
      search: tableState.query || undefined,
    }) as AdminListQueryOptions,
  )
  const total = listQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / tableState.pageSize))

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <DataTableToolbar
          query={tableState.query}
          onQueryChange={(query) => setTableState({ query, page: 1 })}
          onReset={() => setTableState({ query: '', page: 1 })}
        />
        {toolbarActions ? (
          <div className="shrink-0">{toolbarActions}</div>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {listQuery.isLoading ? <ScreenSkeleton label={loadingLabel} /> : null}
      {listQuery.isError ? (
        <ErrorPanel
          message={errorMessage}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}
      {!listQuery.isLoading && !listQuery.isError ? (
        <>
          <DataTable
            columns={columns}
            data={listQuery.data?.items ?? []}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={(next) =>
              setTableState({
                page: next.pageIndex + 1,
                pageSize: normalizePageSize(next.pageSize, tableState.pageSize),
              })
            }
          />
          <DataTablePagination
            pagination={pagination}
            pageCount={pageCount}
            totalRows={total}
            onPaginationChange={(next) =>
              setTableState({
                page: next.pageIndex + 1,
                pageSize: normalizePageSize(next.pageSize, tableState.pageSize),
              })
            }
            onPageSizeChange={(pageSize) =>
              setTableState({ page: 1, pageSize })
            }
          />
        </>
      ) : null}
    </section>
  )
}
