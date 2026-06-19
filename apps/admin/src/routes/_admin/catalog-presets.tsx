import { createFileRoute } from '@tanstack/react-router'

import { CatalogPresetsPage } from '#/features/catalog-presets'
import { tableSearchSchema } from '#/lib/admin-search-schemas'
import { requirePermission } from '#/lib/platform-rbac'

export const Route = createFileRoute('/_admin/catalog-presets')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context.queryClient, 'manage_catalog_presets')
  },
  validateSearch: tableSearchSchema,
  component: CatalogPresetsRoute,
})

function CatalogPresetsRoute() {
  return <CatalogPresetsPage />
}
