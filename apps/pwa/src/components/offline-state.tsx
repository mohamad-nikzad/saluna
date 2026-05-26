import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Card, CardContent } from '@repo/ui/card'
import { cn } from '@repo/ui/utils'

type NetworkStatusBannerProps = {
  routeLabel: string
  isOnline: boolean
  hasSnapshot: boolean
  snapshotUpdatedAt?: string | null
  hasError?: boolean
  onRetry?: () => void
}

export function NetworkStatusBanner({
  routeLabel,
  isOnline,
  hasSnapshot,
  hasError = false,
  onRetry,
}: NetworkStatusBannerProps) {
  if (isOnline && !hasError) return null

  const message = !isOnline
    ? hasSnapshot
      ? `${routeLabel} در حالت آفلاین نمایش داده می‌شود.`
      : `برای مشاهده ${routeLabel} باید آنلاین باشید.`
    : hasSnapshot
      ? `${routeLabel} موقتا با داده ذخیره شده نمایش داده می‌شود.`
      : `بارگذاری ${routeLabel} کامل نشد.`

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b px-3 py-2 text-xs sm:text-sm',
        !isOnline
          ? 'border-amber-400/35 bg-amber-50/80 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100'
          : 'border-primary/20 bg-primary/5 text-foreground',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-2">
        {!isOnline ? (
          <WifiOff className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        ) : (
          <Wifi className="size-4 shrink-0 text-primary" />
        )}
        <p className="truncate">{message}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={onRetry}
        >
          <RefreshCw className="ml-1 size-3.5" />
          تلاش دوباره
        </Button>
      ) : null}
    </div>
  )
}

type OfflineStateCardProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function OfflineStateCard({
  title,
  description,
  actionLabel = 'تلاش دوباره',
  onAction,
}: OfflineStateCardProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/60 shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <WifiOff className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {onAction ? (
            <Button type="button" variant="outline" className="mt-1" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
