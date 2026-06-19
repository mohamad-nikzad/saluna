import { createFileRoute } from '@tanstack/react-router'

import { SalonsListPage } from '#/features/salons'
import { tableSearchSchema } from '#/lib/admin-search-schemas'

export const Route = createFileRoute('/_admin/salons/')({
  validateSearch: tableSearchSchema,
  component: SalonsIndexRoute,
})

function SalonsIndexRoute() {
  return <SalonsListPage />
}
