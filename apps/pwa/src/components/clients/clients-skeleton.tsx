import { Skeleton } from '@repo/ui/skeleton'
import { Button } from '@repo/ui/button'
import { Plus } from 'lucide-react'
import { SearchInput } from '@repo/ui/search-input'

function ClientRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-8 rounded-md shrink-0" />
    </div>
  )
}

export function ClientsSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center justify-between gap-4 bg-card px-4 py-3 border-b border-border/50">
        <h1 className="text-lg font-bold">مشتریان</h1>
        <Button size="sm" disabled className="gap-1.5 touch-manipulation">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">مشتری جدید</span>
        </Button>
      </header>

      <div className="bg-card px-4 pb-3">
        <SearchInput
          placeholder="جستجوی مشتری…"
          disabled
          containerClassName="border-0 bg-muted/50 shadow-none"
        />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-border/50">
          {Array.from({ length: 8 }).map((_, i) => (
            <ClientRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
