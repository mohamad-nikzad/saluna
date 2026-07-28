import { Button } from '@repo/ui/button'

type DefaultRouteErrorProps = {
  error: Error
  reset: () => void
}

export function DefaultRouteError({ error, reset }: DefaultRouteErrorProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        مشکلی در بارگذاری این صفحه پیش آمد
      </p>
      <p className="text-xs text-destructive">{error.message}</p>
      <Button type="button" variant="outline" onClick={reset}>
        تلاش مجدد
      </Button>
    </div>
  )
}
