import { createFileRoute } from '@tanstack/react-router'

import { useAuth } from '#/lib/auth'
import { ManagerToday, StaffToday } from '#/components/today'

export const Route = createFileRoute('/_authed/today')({
  component: TodayPage,
})

function TodayPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  if (user.role === 'manager') {
    return <ManagerToday userName={user.name} />
  }

  return <StaffToday userName={user.name} enabled />
}
