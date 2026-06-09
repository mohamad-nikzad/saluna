import { Skeleton } from '@repo/ui/skeleton'
import { pageHeaderBackButtonClassName } from '#/components/page-header-back-button'
import { cn } from '@repo/ui/utils'

export function StaffDetailSkeleton() {
  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex items-center gap-3 border-b border-line-soft px-[18px] py-3">
        <Skeleton className={cn(pageHeaderBackButtonClassName)} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      </header>

      <div className="border-b border-line-soft px-[18px] py-5">
        <div className="flex items-center gap-3.5">
          <Skeleton className="size-[66px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-lg" />
              <Skeleton className="h-6 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-0 overflow-auto pb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-b border-line-soft px-[18px] py-4 last:border-b-0"
          >
            <Skeleton className="mb-3 h-4 w-28" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
