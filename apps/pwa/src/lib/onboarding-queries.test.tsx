// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  getApiV1OnboardingQueryKey,
  onboardingQueryOptions,
} from '#/lib/onboarding-queries'

const getApiV1Onboarding = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Onboarding: (...args: unknown[]) => getApiV1Onboarding(...args),
}))

beforeEach(() => {
  getApiV1Onboarding.mockReset()
})

describe('onboarding-queries', () => {
  it('exposes generated onboarding query keys', () => {
    expect(getApiV1OnboardingQueryKey()[0]._id).toBe('getApiV1Onboarding')
  })

  it('maps onboarding status from the generated response', async () => {
    getApiV1Onboarding.mockResolvedValue({
      data: {
        onboarding: {
          salon: {
            id: 's1',
            name: 'Salon',
            slug: 'salon',
            phone: null,
            address: null,
          },
          steps: {
            businessHoursSet: true,
            servicesAdded: false,
            staffAdded: false,
            presenceSet: false,
            publicPageConfigured: false,
            notificationsConfigured: false,
          },
          completedAt: null,
          skippedAt: null,
        },
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(onboardingQueryOptions())

    expect(data.onboarding.steps.businessHoursSet).toBe(true)
    expect(data.onboarding.salon?.slug).toBe('salon')
  })
})
