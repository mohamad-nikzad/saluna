import { MoreHorizontal } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function DataTableRowActions({ label = 'Row actions' }: { label?: string }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label}>
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  )
}
