import { createFileRoute } from '@tanstack/react-router'

import { CatalogPresetsPage } from '#/features/catalog-presets'

export const Route = createFileRoute('/_admin/catalog-presets')({
  component: CatalogPresetsRoute,
})

function CatalogPresetsRoute() {
  return <CatalogPresetsPage />
}
