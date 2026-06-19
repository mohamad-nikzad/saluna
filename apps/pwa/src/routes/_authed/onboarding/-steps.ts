import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@repo/api-client/errors'

import {
  getApiV1OnboardingQueryKey,
  onboardingQueryOptions,
  type OnboardingResponse,
  type OnboardingStatus,
} from '#/lib/onboarding-queries'

// Shared step model for the onboarding route-per-step skeleton (Phase 6).
// Files prefixed with `-` are ignored by the TanStack Router file-route
// generator, so this module is a plain colocated helper, not a route.

export type OnboardingStepId =
  | 'welcome'
  | 'hours'
  | 'services'
  | 'staff'
  | 'presence'
  | 'public'
  | 'notifications'
  | 'done'

export type OnboardingStepStatusKey = keyof OnboardingStatus['steps']

export type OnboardingStepConfig = {
  id: OnboardingStepId
  /** Route path under `/onboarding`, e.g. `/onboarding/hours`. */
  path: `/onboarding/${OnboardingStepId}`
  /** Small uppercase-ish tag shown above the question. */
  eyebrow: string
  /** The big "question" headline for the step. */
  question: string
  /**
   * The status flag this step completes, if any. `welcome` and `done` are
   * not tracked steps — they have no flag.
   */
  statusKey: OnboardingStepStatusKey | null
  /**
   * Steps that must be completed before this one is reachable. The layout /
   * step `beforeLoad` redirects back to the first unmet prerequisite.
   */
  requires: ReadonlyArray<OnboardingStepStatusKey>
}

// Canonical order: welcome → hours → services → staff → presence → public →
// notifications → done → /calendar.
export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepConfig> = [
  {
    id: 'welcome',
    path: '/onboarding/welcome',
    eyebrow: 'خوش آمدید',
    question: 'بیایید با هم سالن‌تان را راه بیندازیم',
    statusKey: null,
    requires: [],
  },
  {
    id: 'hours',
    path: '/onboarding/hours',
    eyebrow: 'ساعات کاری',
    question: 'سالن چه روزها و ساعت‌هایی باز است؟',
    statusKey: 'businessHoursSet',
    requires: [],
  },
  {
    id: 'services',
    path: '/onboarding/services',
    eyebrow: 'خدمات',
    question: 'چه خدماتی ارائه می‌دهید؟',
    statusKey: 'servicesAdded',
    requires: [],
  },
  {
    id: 'staff',
    path: '/onboarding/staff',
    eyebrow: 'پرسنل',
    question: 'اولین عضو تیم را اضافه کنید',
    statusKey: 'staffAdded',
    requires: ['servicesAdded'],
  },
  {
    id: 'presence',
    path: '/onboarding/presence',
    eyebrow: 'حضور',
    question: 'مشتری‌ها چطور پیدایتان کنند؟',
    statusKey: 'presenceSet',
    requires: ['servicesAdded', 'staffAdded'],
  },
  {
    id: 'public',
    path: '/onboarding/public',
    eyebrow: 'صفحه عمومی',
    question: 'صفحه نوبت‌دهی آنلاین‌تان را آماده کنید',
    statusKey: 'publicPageConfigured',
    requires: ['servicesAdded', 'staffAdded'],
  },
  {
    id: 'notifications',
    path: '/onboarding/notifications',
    eyebrow: 'اعلان‌ها',
    question: 'چطور از نوبت‌های جدید باخبر شوید؟',
    statusKey: 'notificationsConfigured',
    requires: ['servicesAdded', 'staffAdded'],
  },
  {
    id: 'done',
    path: '/onboarding/done',
    eyebrow: 'تمام شد',
    question: 'سالن‌تان آماده است!',
    statusKey: null,
    requires: [],
  },
] as const

export const ONBOARDING_STEP_BY_ID: Record<
  OnboardingStepId,
  OnboardingStepConfig
> = Object.fromEntries(
  ONBOARDING_STEPS.map((step) => [step.id, step]),
) as Record<OnboardingStepId, OnboardingStepConfig>

/** Index of a step in the canonical order, for progress display. */
export function stepIndex(id: OnboardingStepId): number {
  return ONBOARDING_STEPS.findIndex((step) => step.id === id)
}

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/** The step after `id`, or `null` when `id` is the last step (`done`). */
export function nextStep(id: OnboardingStepId): OnboardingStepConfig | null {
  const idx = stepIndex(id)
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return null
  return ONBOARDING_STEPS[idx + 1] ?? null
}

/**
 * The first tracked step whose status flag is still false, in canonical
 * order. Returns `welcome` when nothing is done yet, and `done` when every
 * tracked step is complete.
 */
export function firstIncompleteStep(
  status: OnboardingStatus,
): OnboardingStepConfig {
  const anyTrackedComplete = ONBOARDING_STEPS.some(
    (step) => step.statusKey !== null && status.steps[step.statusKey],
  )
  // Fresh salons haven't confirmed any step yet — always start at welcome.
  if (!anyTrackedComplete) return ONBOARDING_STEP_BY_ID.welcome

  for (const step of ONBOARDING_STEPS) {
    if (step.statusKey === null) {
      // Skip the non-tracked welcome screen when picking a resume point;
      // `done` is handled by falling through the loop.
      if (step.id === 'welcome') continue
      // Reaching `done` means all tracked steps are complete.
      return step
    }
    if (!status.steps[step.statusKey]) return step
  }
  return ONBOARDING_STEP_BY_ID.done
}

/** First prerequisite of `step` that is not yet satisfied, or `null`. */
export function firstUnmetPrerequisite(
  step: OnboardingStepConfig,
  status: OnboardingStatus,
): OnboardingStepConfig | null {
  for (const required of step.requires) {
    if (!status.steps[required]) {
      const owner = ONBOARDING_STEPS.find((s) => s.statusKey === required)
      if (owner) return owner
    }
  }
  return null
}

/**
 * `beforeLoad` guard shared by every step route. Redirects out of onboarding
 * when it is finished, and back to the first unmet prerequisite when the
 * manager deep-links to a step they can't reach yet (e.g. refresh on
 * `/onboarding/staff` before services exist).
 */
export async function guardStep(
  queryClient: QueryClient,
  id: OnboardingStepId,
): Promise<void> {
  let status: OnboardingStatus | undefined =
    queryClient.getQueryData<OnboardingResponse>(
      getApiV1OnboardingQueryKey(),
    )?.onboarding

  if (!status) {
    try {
      const data = await queryClient.ensureQueryData(onboardingQueryOptions())
      status = data.onboarding
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw redirect({ to: '/auth', search: { redirect: '/onboarding' } })
      }
      // Offline / fetch failure: don't block the step from rendering.
      return
    }
  }

  if (status.completedAt || status.skippedAt) {
    throw redirect({ to: '/calendar' })
  }

  const step = ONBOARDING_STEP_BY_ID[id]
  const unmet = firstUnmetPrerequisite(step, status)
  if (unmet) {
    throw redirect({ to: unmet.path })
  }
}
