import { Link } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'

import { commandActions, adminNavItems } from '#/components/layout/nav-items'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useSearch } from '#/context/search-provider'
import { cn } from '#/lib/utils'

export function CommandMenu() {
  const { open, query, setOpen, setQuery } = useSearch()
  const normalizedQuery = query.trim().toLowerCase()
  const results = adminNavItems.filter((item) => {
    if (!normalizedQuery) return true
    return [item.title, ...item.keywords].some((value) => value.toLowerCase().includes(normalizedQuery))
  })

  return (
    <div className={cn('fixed inset-0 z-50 transition', open ? 'opacity-100' : 'pointer-events-none opacity-0')}>
      <div className="absolute inset-0 bg-foreground/35" onClick={() => setOpen(false)} />
      <div className="absolute left-1/2 top-16 w-[min(92vw,640px)] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی مسیرهای ادمین V1..."
            className="border-0 bg-transparent px-0 shadow-none focus:ring-0"
          />
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="بستن جستجو">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[460px] overflow-y-auto p-2">
          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            مسیرها
          </div>
          {results.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => {
                  setOpen(false)
                  setQuery('')
                }}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.title}</span>
              </Link>
            )
          })}
          <div className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            عملیات سریع
          </div>
          {commandActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.title}
                to={action.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{action.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
