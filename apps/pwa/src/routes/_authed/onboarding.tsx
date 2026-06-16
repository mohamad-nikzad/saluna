import {
  Outlet,
  createFileRoute,
  isRedirect,
  redirect,
  useChildMatches,
} from '@tanstack/react-router'
import type { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@repo/api-client/errors'
import { SakuraMark } from '@repo/ui/sakura-mark'

import {
  onboardingQueryOptions,
  type OnboardingStatus,
} from '#/lib/onboarding-queries'
import { ThinProgress } from './onboarding/-shell'
import { ONBOARDING_STEPS } from './onboarding/-steps'
import type { OnboardingStepId } from './onboarding/-steps'

// ── Onboarding layout route ────────────────────────────────────────────────
// This file is the LAYOUT route for `/_authed/onboarding`. The actual step
// screens live in `./onboarding/*.tsx` and render through the <Outlet/> below.
// (The legacy single-route `OnboardingPage` was removed in the Phase 7
// cleanup; these per-step screens replace it.)
//
// Why the layout lives here instead of `./onboarding/route.tsx`: TanStack's
// file-route generator maps BOTH `onboarding.tsx` and `onboarding/route.tsx`
// to the route id `/_authed/onboarding` and errors with "Conflicting
// configuration paths". Keeping the layout in this file (which the generator
// already treats as the parent of the `onboarding/` directory's children)
// avoids the collision.

export const Route = createFileRoute('/_authed/onboarding')({
  beforeLoad: async ({ context }) => {
    const status = await loadOnboardingStatus(context.queryClient)

    // Offline / fetch failure: don't block — let the shell render.
    if (!status) return { onboarding: null }

    // Completed or skipped → leave onboarding entirely.
    if (status.completedAt || status.skippedAt) {
      throw redirect({ to: '/calendar' })
    }

    // Bare `/onboarding` is handled by the index route's own redirect; step
    // guards handle deep-link prerequisites. Here we just expose status.
    return { onboarding: status }
  },
  component: OnboardingLayout,
})

/**
 * Fetch onboarding status through the shared TanStack Query cache. Returns
 * `null` on network failure so callers can degrade gracefully.
 */
export async function loadOnboardingStatus(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<OnboardingStatus | null> {
  try {
    const data = await queryClient.ensureQueryData(onboardingQueryOptions())
    return data.onboarding
  } catch (err) {
    if (isRedirect(err)) throw err
    if (err instanceof ApiError && err.status === 401) {
      throw redirect({ to: '/auth', search: { redirect: '/onboarding' } })
    }
    return null
  }
}

function OnboardingLayout() {
  const { onboarding } = Route.useRouteContext()
  const childMatches = useChildMatches()
  // The active step id is the last path segment of the deepest child match.
  const activeId = (() => {
    const last = childMatches.at(-1)
    const segment = last?.pathname.split('/').filter(Boolean).pop()
    return ONBOARDING_STEPS.some((s) => s.id === segment)
      ? (segment as OnboardingStepId)
      : 'welcome'
  })()

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      <header className="border-b border-line-soft bg-card px-5 py-3">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <SakuraMark size={28} color="var(--primary)" />
            <span className="text-sm font-bold text-foreground">
              {onboarding?.salon?.name ?? 'راه‌اندازی سالن'}
            </span>
          </div>
          <ThinProgress current={activeId} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
