import { MoreHorizontal } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function DataTableRowActions({ label = 'عملیات ردیف' }: { label?: string }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} title={label}>
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  )
}
