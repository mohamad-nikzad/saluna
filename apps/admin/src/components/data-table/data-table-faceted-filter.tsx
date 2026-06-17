import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

export function DataTableFacetedFilter({
  label,
  options,
}: {
  label: string
  options: Array<{ label: string; value: string }>
}) {
  return (
    <Button variant="outline" size="sm">
      {label}
      <Badge variant="outline">{options.length}</Badge>
    </Button>
  )
}
