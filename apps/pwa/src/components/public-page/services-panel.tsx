import { useMemo, useState } from 'react'
import { Eye, EyeOff, Search, X } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Input } from '@repo/ui/input'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { formatTomansPrice } from './types'
import type { ServiceRow } from './types'

export function ServicesPanel({
  services,
  onToggle,
  onSetAllVisible,
}: {
  services: ServiceRow[]
  onToggle: (id: string, visible: boolean) => void
  onSetAllVisible: (visible: boolean, category?: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')

  const grouped = useMemo(() => {
    const q = query.trim()
    const filtered = services.filter((s) => {
      if (q && !s.name.includes(q)) return false
      if (filter === 'visible' && !s.visible) return false
      if (filter === 'hidden' && s.visible) return false
      return true
    })
    const map = new Map<string, ServiceRow[]>()
    for (const s of filtered) {
      const arr = map.get(s.category) ?? []
      arr.push(s)
      map.set(s.category, arr)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fa'))
  }, [services, query, filter])

  const visibleCount = services.filter((s) => s.visible).length

  return (
    <div className="pb-5">
      <div className="sticky top-0 z-10 flex flex-col gap-2.5 bg-background/95 px-5 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی خدمت…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="پاک کردن"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2 rounded-lg bg-muted p-0.5 text-xs">
            {(['all', 'visible', 'hidden'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1.5 transition',
                  filter === f && 'bg-card font-medium shadow-sm',
                )}
              >
                {f === 'all' ? 'همه' : f === 'visible' ? 'فعال' : 'مخفی'}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {toPersianDigits(visibleCount)}/{toPersianDigits(services.length)}{' '}
            فعال
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pt-3">
        {grouped.map(([cat, items]) => {
          const visibleInCat = items.filter((s) => s.visible).length
          const allOn = visibleInCat === items.length
          return (
            <div
              key={cat}
              className="overflow-hidden rounded-xl border bg-card"
            >
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cat}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {toPersianDigits(visibleInCat)}/
                    {toPersianDigits(items.length)}
                  </Badge>
                </div>
                <button
                  type="button"
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => onSetAllVisible(!allOn, cat)}
                >
                  {allOn ? 'مخفی کردن همه' : 'نمایش همه'}
                </button>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {items.map((s) => (
                  <button
                    key={s.serviceId}
                    type="button"
                    onClick={() => onToggle(s.serviceId, !s.visible)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-right transition',
                      s.visible
                        ? 'border-foreground/15 bg-background'
                        : 'border-dashed border-border bg-muted/30 opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {s.visible ? (
                        <Eye className="h-4 w-4 shrink-0 text-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatTomansPrice(s.price)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            هیچ خدمتی پیدا نشد.
          </p>
        )}
      </div>
    </div>
  )
}
