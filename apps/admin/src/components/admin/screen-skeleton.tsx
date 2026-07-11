import { Skeleton } from '#/components/ui/skeleton'

export function ScreenSkeleton({
  label = 'در حال بارگذاری',
}: {
  label?: string
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <Skeleton className="h-5 w-52" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
