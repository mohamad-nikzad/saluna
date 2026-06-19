import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'

import { authQueryKey } from '#/lib/auth'
import type { AuthSession } from '#/lib/auth'
import { BottomNav } from '#/components/bottom-nav'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData<AuthSession>({
      queryKey: authQueryKey,
    })
    if (!session) {
      throw redirect({
        to: '/auth',
        search: { redirect: location.href },
      })
    }
    if (session.status === 'needs_workspace') {
      throw redirect({ to: '/signup' })
    }

    const { user } = session
    if (
      user.role === 'manager' &&
      user.needsOnboarding &&
      !location.pathname.startsWith('/onboarding')
    ) {
      throw redirect({ to: '/onboarding' })
    }

    return { user }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hideChrome = pathname.startsWith('/onboarding')

  return (
    <div className="flex h-dvh flex-col bg-background">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {!hideChrome && <BottomNav />}
    </div>
  )
}
