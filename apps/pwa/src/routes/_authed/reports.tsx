import { createFileRoute, redirect } from '@tanstack/react-router'

import { SalonReportsPage } from '#/components/reports/salon-reports-page'

export const Route = createFileRoute('/_authed/reports')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') throw redirect({ to: '/earnings' })
  },
  component: SalonReportsPage,
})
