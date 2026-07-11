import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { MessagingProviderId } from '@repo/api-client/types'

import {
  getApiV1MessagingAccountsQueryKey,
  messagingAccountsQueryOptions,
  type MessagingAccount,
} from '#/lib/messaging-queries'
import {
  getApiV1OnboardingQueryKey,
  onboardingQueryOptions,
} from '#/lib/onboarding-queries'
import {
  MESSAGING_PROVIDER_CONFIGS,
  type MessagingProviderConfig,
} from '#/components/messaging/messaging-provider-config'
import { MessagingConnectCard } from '#/components/messaging/telegram-connect-card'
import { useMessagingConnect } from '#/components/messaging/use-messaging-connect'
import { useTelegramFocusRefresh } from '#/components/messaging/use-telegram-focus-refresh'
import { PillCTA, StepBody } from './-shell'
import { ONBOARDING_STEP_BY_ID } from './-steps'

export function NotificationsScreen() {
  const step = ONBOARDING_STEP_BY_ID.notifications
  const navigate = useNavigate()

  const onboardingQuery = useQuery({
    ...onboardingQueryOptions(),
    refetchOnWindowFocus: true,
  })

  const messagingAccountsQuery = useQuery({
    ...messagingAccountsQueryOptions(),
    refetchOnWindowFocus: true,
  })

  const accounts = messagingAccountsQuery.data?.accounts ?? []
  const configuredProviderIds = new Set<MessagingProviderId>(
    messagingAccountsQuery.data?.providers?.map((provider) => provider.id) ??
      [],
  )
  const linkedProviderIds = new Set<MessagingProviderId>(
    accounts.map((account) => account.provider),
  )
  const visibleProviderConfigs = MESSAGING_PROVIDER_CONFIGS.filter(
    (config) =>
      configuredProviderIds.has(config.provider) ||
      linkedProviderIds.has(config.provider),
  )
  const hasConfiguredProviders = configuredProviderIds.size > 0

  useTelegramFocusRefresh([
    getApiV1OnboardingQueryKey(),
    getApiV1MessagingAccountsQueryKey(),
  ])

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
        با اتصال به پیام‌رسان، نوبت‌های جدید را فوری دریافت می‌کنید و می‌توانید
        همان‌جا تأیید یا رد کنید.
      </p>

      {visibleProviderConfigs.map((config) => (
        <OnboardingMessagingConnectCard
          key={config.provider}
          config={config}
          account={
            accounts.find((account) => account.provider === config.provider) ??
            null
          }
          isRefreshing={
            onboardingQuery.isFetching || messagingAccountsQuery.isFetching
          }
        />
      ))}

      {!messagingAccountsQuery.isPending &&
        !hasConfiguredProviders &&
        visibleProviderConfigs.length === 0 && (
          <p className="rounded-2xl border border-line-soft bg-card p-4 text-sm leading-relaxed text-muted-foreground">
            فعلاً پیام‌رسانی برای اتصال فعال نیست. می‌توانید این مرحله را ادامه
            دهید.
          </p>
        )}
    </StepBody>
  )
}

function OnboardingMessagingConnectCard({
  config,
  account,
  isRefreshing,
}: {
  config: MessagingProviderConfig
  account: MessagingAccount | null
  isRefreshing: boolean
}) {
  const { connect, isPending, linkError } = useMessagingConnect(
    config.provider,
    {
      errorMessage: config.errorMessage,
      skipErrorToast: true,
      skipSuccessToast: true,
      invalidateQueries: [],
      invalidateDelayMs: 0,
    },
  )

  return (
    <MessagingConnectCard
      provider={config.provider}
      configured={account !== null}
      isRefreshing={isRefreshing}
      linkError={linkError}
      onConnect={connect}
      isConnecting={isPending}
    />
  )
}
