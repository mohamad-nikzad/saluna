import { RotateCcw } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <p>{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={onRetry}
        >
          <RotateCcw className="h-4 w-4" />
          تلاش مجدد
        </Button>
      ) : null}
    </div>
  )
}
