import { Filter, RotateCcw, SlidersHorizontal } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

export function DataTableToolbar({
  query,
  onQueryChange,
  onReset,
}: {
  query: string
  onQueryChange: (query: string) => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="جستجو در جدول..."
          className="max-w-sm"
        />
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4" />
          فیلترها
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
          پاک‌سازی
        </Button>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4" />
          نمایش
        </Button>
      </div>
    </div>
  )
}
