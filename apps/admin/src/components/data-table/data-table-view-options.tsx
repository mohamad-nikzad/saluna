import { Columns3 } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function DataTableViewOptions() {
  return (
    <Button variant="outline" size="sm">
      <Columns3 className="h-4 w-4" />
      Columns
    </Button>
  )
}
