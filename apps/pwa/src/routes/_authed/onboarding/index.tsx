import { createFileRoute, redirect } from '@tanstack/react-router'

import { loadOnboardingStatus } from '../onboarding'
import { firstIncompleteStep } from './-steps'

// Bare `/onboarding` renders nothing — it resolves where the manager should be
// and redirects there.
export const Route = createFileRoute('/_authed/onboarding/')({
  beforeLoad: async ({ context }) => {
    const status = await loadOnboardingStatus(context.queryClient)
    if (!status) {
      // Offline: fall back to the welcome screen rather than blocking.
      throw redirect({ to: '/onboarding/welcome' })
    }
    if (status.completedAt || status.skippedAt) {
      throw redirect({ to: '/calendar' })
    }
    throw redirect({ to: firstIncompleteStep(status).path })
  },
  component: () => null,
})
