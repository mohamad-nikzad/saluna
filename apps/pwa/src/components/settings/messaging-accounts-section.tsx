import { useMutation, useQuery } from '@tanstack/react-query'
import { Send, Unlink } from 'lucide-react'
import type {
  MessagingAccount,
  MessagingProviderId,
} from '@repo/api-client'

import { useAuth } from '#/lib/auth'
import { api } from '#/lib/api-client'
import { messagingAccountsQueryKey } from '#/lib/query-keys'
import { useMessagingConnect } from '#/components/messaging/use-messaging-connect'

import { SettingsRow, ToggleRow } from '#/components/settings/settings-rows'

type MessagingProviderRowConfig = {
  provider: MessagingProviderId
  displayName: string
  toggleLabel: string
  connectLabel: string
  connectHint: string
}

const MESSAGING_PROVIDER_ROWS = [
  {
    provider: 'telegram',
    displayName: 'تلگرام',
    toggleLabel: 'اعلان تلگرام',
    connectLabel: 'اتصال تلگرام',
    connectHint: 'دریافت اعلان درخواست نوبت در تلگرام',
  },
  {
    provider: 'bale',
    displayName: 'بله',
    toggleLabel: 'اعلان بله',
    connectLabel: 'اتصال بله',
    connectHint: 'دریافت اعلان درخواست نوبت در بله',
  },
] as const satisfies ReadonlyArray<MessagingProviderRowConfig>

export function MessagingAccountsSection() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  const messagingAccountsQuery = useQuery({
    queryKey: messagingAccountsQueryKey,
    queryFn: ({ signal }) => api.messaging.listAccounts({ signal }),
    enabled: isManager,
  })

  if (!isManager) return null

  const accounts = messagingAccountsQuery.data?.accounts ?? []
  const configuredProviderIds = new Set<MessagingProviderId>(
    messagingAccountsQuery.data?.providers?.map((provider) => provider.id) ??
      MESSAGING_PROVIDER_ROWS.map((provider) => provider.provider),
  )
  const linkedProviderIds = new Set<MessagingProviderId>(
    accounts.map((account) => account.provider),
  )
  const visibleProviderRows = MESSAGING_PROVIDER_ROWS.filter(
    (config) =>
      configuredProviderIds.has(config.provider) ||
      linkedProviderIds.has(config.provider),
  )

  return (
    <>
      {visibleProviderRows.map((config) => (
        <MessagingProviderRow
          key={config.provider}
          config={config}
          account={
            accounts.find((account) => account.provider === config.provider) ??
            null
          }
          accountsLoading={messagingAccountsQuery.isPending}
        />
      ))}
    </>
  )
}

function MessagingProviderRow({
  config,
  account,
  accountsLoading,
}: {
  config: MessagingProviderRowConfig
  account: MessagingAccount | null
  accountsLoading: boolean
}) {
  const { connect, isPending: isConnecting } = useMessagingConnect(
    config.provider,
    {
      errorMessage: `اتصال ${config.displayName} انجام نشد`,
      invalidateQueries: [messagingAccountsQueryKey],
      invalidateDelayMs: 4000,
    },
  )

  const toggleAccount = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.messaging.setEnabled(id, enabled),
    meta: {
      skipSuccessToast: true,
      errorMessage: `تغییر وضعیت ${config.displayName} انجام نشد`,
      invalidatesQuery: messagingAccountsQueryKey,
    },
  })

  const unlinkAccount = useMutation({
    mutationFn: (id: string) => api.messaging.unlink(id),
    meta: {
      successMessage: `اتصال ${config.displayName} قطع شد`,
      errorMessage: `قطع اتصال ${config.displayName} انجام نشد`,
      invalidatesQuery: messagingAccountsQueryKey,
    },
  })

  if (account) {
    return (
      <>
        <ToggleRow
          icon={Send}
          label={config.toggleLabel}
          hint={
            account.displayName
              ? `متصل به ${account.displayName}`
              : 'متصل'
          }
          checked={account.enabled}
          disabled={toggleAccount.isPending}
          onChange={(next) =>
            toggleAccount.mutate({ id: account.id, enabled: next })
          }
        />
        <SettingsRow
          icon={Unlink}
          label={`قطع اتصال ${config.displayName}`}
          onClick={() => {
            if (window.confirm(`اتصال ${config.displayName} قطع شود؟`)) {
              unlinkAccount.mutate(account.id)
            }
          }}
          danger
          loading={unlinkAccount.isPending}
          disabled={unlinkAccount.isPending}
        />
      </>
    )
  }

  return (
    <SettingsRow
      icon={Send}
      label={config.connectLabel}
      hint={config.connectHint}
      onClick={connect}
      loading={isConnecting}
      disabled={isConnecting || accountsLoading}
    />
  )
}
