import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@repo/api-client/errors'
import type { AuthSession } from '#/lib/auth'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({ options }),
  redirect: (options: unknown) => ({ redirect: options }),
  isRedirect: (value: unknown) =>
    typeof value === 'object' && value !== null && 'redirect' in value,
}))
vi.mock('#/lib/auth', () => ({ authQueryKey: ['auth', 'me'] }))
vi.mock('#/components/bottom-nav', () => ({ BottomNav: () => null }))
vi.mock('#/lib/onboarding-queries', () => ({
  onboardingQueryOptions: () => ({ queryKey: ['onboarding'] }),
}))
vi.mock('./_authed/onboarding/-shell', () => ({ ThinProgress: () => null }))
vi.mock('./_authed/onboarding/-steps', () => ({ ONBOARDING_STEPS: [] }))

import { Route } from './_authed'
import { loadOnboardingStatus } from './_authed/onboarding'

function enterRoute(role: 'staff' | 'manager', pathname: string) {
  const session = {
    status: 'ready',
    user: { role, needsOnboarding: true },
  } as AuthSession
  const beforeLoad = Route.options.beforeLoad
  if (!beforeLoad) throw new Error('Missing authenticated route guard')
  return beforeLoad({
    context: {
      queryClient: { ensureQueryData: vi.fn().mockResolvedValue(session) },
    },
    location: { pathname, href: pathname },
  } as unknown as Parameters<typeof beforeLoad>[0])
}

describe('salon setup access', () => {
  it.each(['/onboarding', '/onboarding/welcome', '/onboarding/hours'])(
    'sends staff with a saved %s redirect to their working screen',
    async (pathname) => {
      await expect(enterRoute('staff', pathname)).rejects.toEqual({
        redirect: { to: '/today' },
      })
    },
  )

  it('allows staff to enter their working screen', async () => {
    await expect(enterRoute('staff', '/today')).resolves.toMatchObject({
      user: { role: 'staff' },
    })
  })

  it('keeps setup available to managers', async () => {
    await expect(
      enterRoute('manager', '/onboarding/welcome'),
    ).resolves.toMatchObject({
      user: { role: 'manager' },
    })
    await expect(enterRoute('manager', '/today')).rejects.toEqual({
      redirect: { to: '/onboarding' },
    })
  })

  it('leaves setup when its API denies access', async () => {
    const client = new QueryClient()
    vi.spyOn(client, 'ensureQueryData').mockRejectedValue(
      new ApiError('Forbidden', 403, null),
    )
    await expect(loadOnboardingStatus(client)).rejects.toEqual({
      redirect: { to: '/today' },
    })
    client.clear()
  })

  it('preserves the offline fallback for network failures', async () => {
    const client = new QueryClient()
    vi.spyOn(client, 'ensureQueryData').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )
    await expect(loadOnboardingStatus(client)).resolves.toBeNull()
    client.clear()
  })
})
