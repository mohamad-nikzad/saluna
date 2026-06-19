import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground/85">{icon}</span> : null}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function DetailGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 rounded-md border border-border/70 bg-background/35 px-3 py-2.5"
        >
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-sm font-medium">
            {value || '-'}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CompactRows({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: string; badge?: string; href?: string }>
  empty: string
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const content = (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/35 px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {row.label || '-'}
              </div>
              {row.badge ? (
                <div className="truncate text-xs text-muted-foreground">
                  {row.badge}
                </div>
              ) : null}
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {row.value}
            </span>
          </div>
        )

        if (!row.href) {
          return <div key={`${row.label}-${index}`}>{content}</div>
        }

        return (
          <Link
            key={`${row.label}-${index}`}
            to={row.href}
            className="block rounded-md transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {content}
          </Link>
        )
      })}
    </div>
  )
}
