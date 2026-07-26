import { Check, Send } from 'lucide-react'
import type { MessagingProviderId } from '@repo/api-client/types'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'

import { getMessagingProviderConfig } from './messaging-provider-config'

export function MessagingConnectCard({
  provider,
  configured,
  isRefreshing = false,
  linkError = null,
  onConnect,
  isConnecting,
}: {
  provider: MessagingProviderId
  configured: boolean
  isRefreshing?: boolean
  linkError?: string | null
  onConnect: () => void
  isConnecting: boolean
}) {
  const config = getMessagingProviderConfig(provider)

  if (!config) return null

  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blush-soft text-primary">
          {configured ? (
            <Check className="size-5" />
          ) : (
            <Send className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{config.botName}</p>
          <p className="text-xs text-muted-foreground">
            {configured ? config.linkedHint : config.unlinkedHint}
          </p>
        </div>
        {isRefreshing && <Spinner className="size-4" />}
      </div>

      {!configured && (
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full rounded-2xl"
          disabled={isConnecting}
          onClick={onConnect}
        >
          {isConnecting && <Spinner className="ml-2 size-4" />}
          اتصال به {config.botName}
        </Button>
      )}

      {linkError && <p className="text-xs text-destructive">{linkError}</p>}
    </>
  )
}
