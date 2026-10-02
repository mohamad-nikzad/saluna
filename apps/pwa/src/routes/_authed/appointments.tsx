import { createFileRoute, redirect } from '@tanstack/react-router'

import { AppointmentListPage } from '#/components/appointments/appointment-list-page'

export const Route = createFileRoute('/_authed/appointments')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') throw redirect({ to: '/today' })
  },
  component: AppointmentListPage,
})
