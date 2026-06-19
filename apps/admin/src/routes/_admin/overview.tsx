import { createFileRoute } from '@tanstack/react-router'

import { OverviewPage } from '#/features/overview'

export const Route = createFileRoute('/_admin/overview')({
  component: OverviewRoute,
})

function OverviewRoute() {
  return <OverviewPage />
}
