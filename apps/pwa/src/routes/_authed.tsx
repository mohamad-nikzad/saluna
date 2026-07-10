import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'

import { authQueryKey } from '#/lib/auth'
import type { AuthSession } from '#/lib/auth'
import { BottomNav } from '#/components/bottom-nav'
import { cn } from '@repo/ui/utils'

function isSupportTicketDetail(pathname: string) {
  return pathname.startsWith('/support/') && pathname !== '/support/new'
}

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
    if (session.status === 'needs_staff_password') {
      throw redirect({ to: '/auth' })
    }
    if (session.status === 'needs_salon_selection') {
      throw redirect({ to: '/select-salon' })
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
  const hideBottomNav =
    pathname.startsWith('/onboarding') || isSupportTicketDetail(pathname)
  const fullHeightMain = isSupportTicketDetail(pathname)

  return (
    <div className="flex h-dvh flex-col bg-background">
      <main
        className={cn(
          'flex-1',
          fullHeightMain ? 'min-h-0 overflow-hidden' : 'overflow-auto',
        )}
      >
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
