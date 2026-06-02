import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { api } from '#/lib/api-client'
import {
  messagingAccountsQueryKey,
  onboardingQueryKey,
} from '#/lib/query-keys'
import { TelegramConnectCard } from '#/components/messaging/telegram-connect-card'
import { useTelegramConnect } from '#/components/messaging/use-telegram-connect'
import { useTelegramFocusRefresh } from '#/components/messaging/use-telegram-focus-refresh'
import { PillCTA, StepBody } from './-shell'
import { guardStep, ONBOARDING_STEP_BY_ID } from './-steps'

// Optional step. Opens the Telegram bot deep link; on return the derived
// `notificationsConfigured` flag flips once the account is linked. "بعداً"
// advances without action.
export const Route = createFileRoute('/_authed/onboarding/notifications')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'notifications'),
  component: NotificationsScreen,
})

function NotificationsScreen() {
  const step = ONBOARDING_STEP_BY_ID.notifications
  const navigate = useNavigate()

  const onboardingQuery = useQuery({
    queryKey: onboardingQueryKey,
    queryFn: ({ signal }) => api.onboarding.get({ signal }),
    refetchOnWindowFocus: true,
  })

  const configured =
    onboardingQuery.data?.onboarding.steps.notificationsConfigured ?? false

  useTelegramFocusRefresh([onboardingQueryKey, messagingAccountsQueryKey])

  const { connect, isPending, linkError } = useTelegramConnect({
    errorMessage: 'ساخت لینک اتصال انجام نشد',
    skipErrorToast: true,
    skipSuccessToast: true,
    invalidateQueries: [],
    invalidateDelayMs: 0,
  })

  return (
    <StepBody
      eyebrow={step.eyebrow}
      question="چطور از نوبت‌های جدید باخبر شوید؟"
      footer={
        <PillCTA onClick={() => navigate({ to: '/onboarding/done' })}>
          ادامه
        </PillCTA>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        با اتصال به ربات تلگرام، نوبت‌های جدید را فوری دریافت می‌کنید و
        می‌توانید همان‌جا تأیید یا رد کنید.
      </p>

      <TelegramConnectCard
        configured={configured}
        isRefreshing={onboardingQuery.isFetching}
        linkError={linkError}
        onConnect={connect}
        isConnecting={isPending}
      />
    </StepBody>
  )
}
