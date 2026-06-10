import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import {
  PresenceFormBody,
  usePresenceForm,
} from '#/components/public-page/presence-form'
import { getApiV1OnboardingQueryKey } from '#/lib/onboarding-queries'
import { getApiV1SalonProfilePresenceQueryKey } from '#/lib/salon-profile-queries'
import { OptionalStepFooter, StepBody } from './-shell'
import { guardStep, ONBOARDING_STEP_BY_ID } from './-steps'

// Optional step. "فعلاً رد کن" advances without saving; "ذخیره و ادامه"
// PATCHes `/salon-profile/presence` then advances.
export const Route = createFileRoute('/_authed/onboarding/presence')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'presence'),
  component: PresenceScreen,
})

function PresenceScreen() {
  const step = ONBOARDING_STEP_BY_ID.presence
  const navigate = useNavigate()
  const [skipping, setSkipping] = useState(false)

  const presence = usePresenceForm({
    invalidatesQuery: [
      getApiV1SalonProfilePresenceQueryKey(),
      getApiV1OnboardingQueryKey(),
    ],
    onSuccess: () => {
      void navigate({ to: '/onboarding/public' })
    },
  })

  const onSkip = async () => {
    setSkipping(true)
    try {
      await navigate({ to: '/onboarding/public' })
    } finally {
      setSkipping(false)
    }
  }

  return (
    <form
      onSubmit={presence.onSubmit}
      noValidate
      className="flex h-full flex-col"
    >
      <StepBody
        eyebrow="اختیاری — هر زمان می‌توانید"
        question={step.question}
        footer={
          <OptionalStepFooter
            onSkip={() => void onSkip()}
            skipping={skipping}
            isSubmitting={presence.isPending}
          />
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          آدرس، نقشه و شبکه‌های اجتماعی روی صفحه‌ی عمومی شما نشان داده می‌شوند.
          همه اختیاری‌اند و بعداً هم قابل ویرایش.
        </p>

        <PresenceFormBody {...presence} />
      </StepBody>
    </form>
  )
}
