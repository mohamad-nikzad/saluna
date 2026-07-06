import { Banknote, Clock3, Pencil } from 'lucide-react'

import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import type { Service } from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

export function ServiceRow({
  service,
  onEdit,
}: {
  service: Service
  onEdit: () => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:px-3 sm:py-2.5">
      <div
        className="h-8 w-1.5 shrink-0 rounded-full sm:h-10"
        style={{ backgroundColor: `var(--calendar-${service.color})` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{service.name}</p>
          {!service.active && (
            <Badge variant="secondary" className="text-[10px]">
              غیرفعال
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:mt-1 sm:gap-1.5 sm:text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
            <Clock3 className="h-3 w-3" />
            {toPersianDigits(service.duration)} دقیقه
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
            <Banknote className="h-3 w-3" />
            {service.price > 0
              ? `${toPersianDigits(service.price.toLocaleString('fa-IR'))} تومان`
              : 'قیمت وارد نشده'}
          </span>
        </div>
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
        aria-label={`ویرایش خدمت ${service.name}`}
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  )
}
