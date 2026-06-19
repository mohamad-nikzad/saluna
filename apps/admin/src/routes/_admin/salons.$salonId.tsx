import { createFileRoute } from '@tanstack/react-router'

import { SalonDetailPage } from '#/features/salons'
import { salonDetailSearchSchema } from '#/lib/admin-search-schemas'

export const Route = createFileRoute('/_admin/salons/$salonId')({
  validateSearch: salonDetailSearchSchema,
  component: SalonDetailRoute,
})

function SalonDetailRoute() {
  const { salonId } = Route.useParams()
  return <SalonDetailPage salonId={salonId} />
}
