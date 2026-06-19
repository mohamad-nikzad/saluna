import type { PaginationState } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  PAGE_SIZE_OPTIONS,
  type PageSizeOption,
} from '#/lib/admin-search-schemas'

export function DataTablePagination({
  pagination,
  pageCount,
  onPaginationChange,
  totalRows,
  onPageSizeChange,
}: {
  pagination: PaginationState
  pageCount: number
  onPaginationChange: (pagination: PaginationState) => void
  totalRows?: number
  onPageSizeChange?: (pageSize: PageSizeOption) => void
}) {
  const page = pagination.pageIndex + 1
  const rowTotal = totalRows ?? 0
  const showRange = totalRows !== undefined
  const start = rowTotal === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const end =
    rowTotal === 0
      ? 0
      : Math.min((pagination.pageIndex + 1) * pagination.pageSize, rowTotal)

  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {showRange ? (
          <div>
            نمایش {start} تا {end} از {totalRows}
          </div>
        ) : (
          <div>
            صفحه {page} از {Math.max(pageCount, 1)}
          </div>
        )}
        {onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span>تعداد در هر صفحه</span>
            <select
              value={pagination.pageSize}
              onChange={(event) =>
                onPageSizeChange(Number(event.target.value) as PageSizeOption)
              }
              aria-label="تعداد در هر صفحه"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.pageIndex <= 0}
          onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex - 1 })}
        >
          <ChevronRight className="h-4 w-4" />
          قبلی
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex + 1 })}
        >
          بعدی
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
