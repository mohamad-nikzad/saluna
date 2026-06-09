import { Skeleton } from '@repo/ui/skeleton'
import { Plus } from 'lucide-react'
import { pageHeaderBackButtonClassName } from '#/components/page-header-back-button'
import { cn } from '@repo/ui/utils'
import { Button } from '@repo/ui/button'

function StaffCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-line-soft bg-card p-3.5">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-lg" />
          <Skeleton className="h-5 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function StaffSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-line-soft bg-card px-[18px] pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className={cn(pageHeaderBackButtonClassName)} />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Button size="icon" disabled className="size-[38px] rounded-xl">
            <Plus className="size-5" />
          </Button>
        </div>
        <div className="mt-3.5 flex gap-2">
          <Skeleton className="h-[58px] flex-1 rounded-[14px]" />
          <Skeleton className="h-[58px] flex-1 rounded-[14px]" />
        </div>
      </header>

      <div className="flex-1 space-y-2.5 overflow-auto px-[18px] pb-8 pt-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <StaffCardSkeleton key={index} />
        ))}
        <Skeleton className="mt-1 h-[52px] w-full rounded-[18px]" />
      </div>
    </div>
  )
}
