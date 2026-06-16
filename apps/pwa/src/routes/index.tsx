import { createFileRoute, redirect } from '@tanstack/react-router'

import { authQueryKey } from '#/lib/auth'
import type { AuthSession } from '#/lib/auth'
import { homePathForRole } from '#/lib/navigation'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData<AuthSession>({
      queryKey: authQueryKey,
    })
    if (!session) {
      throw redirect({ to: '/auth' })
    }
    if (session.status === 'needs_workspace') {
      throw redirect({ to: '/signup' })
    }
    const { user } = session
    throw redirect({ to: homePathForRole(user.role) })
  },
})
