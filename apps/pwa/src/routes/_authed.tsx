import {
  Outlet,
  createFileRoute,
  isRedirect,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import type { User } from '@repo/salon-core/types'

import { authQueryKey } from '#/lib/auth'
import { BottomNav } from '#/components/bottom-nav'
import { onboardingQueryOptions } from '#/lib/onboarding-queries'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData<User | null>({
      queryKey: authQueryKey,
    })
    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }

    if (
      user.role === 'manager' &&
      !location.pathname.startsWith('/onboarding')
    ) {
      try {
        const data = await context.queryClient.ensureQueryData(
          onboardingQueryOptions(),
        )
        const steps = data.onboarding.steps
        if (!steps.servicesAdded || !steps.staffAdded) {
          throw redirect({ to: '/onboarding' })
        }
      } catch (err) {
        if (isRedirect(err)) throw err
        // Network failure: don't block the app.
      }
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
