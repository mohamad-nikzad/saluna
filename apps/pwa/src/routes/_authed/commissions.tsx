import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/commissions')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') throw redirect({ to: '/earnings' })
    throw redirect({ to: '/reports' })
  },
  component: () => null,
})
