import {
  Outlet,
  createFileRoute,
  isRedirect,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import type { OnboardingResponse } from '@repo/api-client'
import type { User } from '@repo/salon-core/types'

import { api } from '#/lib/api-client'
import { authQueryKey } from '#/lib/auth'
import { BottomNav } from '#/components/bottom-nav'
import { ManagerSyncBar } from '#/components/manager-sync-bar'
import { ManagerDataClientProvider } from '#/lib/manager-data-client'
import { onboardingQueryKey } from '#/lib/query-keys'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData<User | null>({
      queryKey: authQueryKey,
    })
    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.pathname },
      })
    }

    if (
      user.role === 'manager' &&
      !location.pathname.startsWith('/onboarding')
    ) {
      try {
        const data = await context.queryClient.ensureQueryData<OnboardingResponse>({
          queryKey: onboardingQueryKey,
          queryFn: ({ signal }) => api.onboarding.get({ signal }),
        })
        const steps = data.onboarding.steps
        if (!steps.servicesAdded || !steps.staffAdded) {
          throw redirect({ to: '/onboarding' })
        }
      } catch (err) {
        if (isRedirect(err)) throw err
        // Offline / network failure: don't block the app.
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
    <ManagerDataClientProvider>
      <div className="flex h-dvh flex-col bg-background">
        {!hideChrome && <ManagerSyncBar />}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        {!hideChrome && <BottomNav />}
      </div>
    </ManagerDataClientProvider>
  )
}
