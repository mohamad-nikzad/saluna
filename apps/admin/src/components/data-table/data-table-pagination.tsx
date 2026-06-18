import type { PaginationState } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function DataTablePagination({
  pagination,
  pageCount,
  onPaginationChange,
}: {
  pagination: PaginationState
  pageCount: number
  onPaginationChange: (pagination: PaginationState) => void
}) {
  const page = pagination.pageIndex + 1

  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        صفحه {page} از {Math.max(pageCount, 1)}
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
