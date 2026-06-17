import { Link, useLocation } from '@tanstack/react-router'
import { X } from 'lucide-react'

import { IconButton } from '#/components/ui/icon-button'
import { adminNavGroups } from '#/components/layout/nav-items'
import { useLayout } from '#/context/layout-provider'
import { cn } from '#/lib/utils'

export function AdminSidebar() {
  const { sidebarOpen, setSidebarOpen } = useLayout()
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex w-72 flex-col bg-sidebar p-2 text-sidebar-foreground transition-transform lg:right-2 lg:top-2 lg:h-[calc(100svh-1rem)] lg:w-64 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      <div className="flex h-full flex-col rounded-lg border border-sidebar-border bg-sidebar shadow-sm">
        <div className="flex h-14 items-center justify-between px-2">
          <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              S
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-normal">Saluna Admin</div>
              <div className="truncate text-xs text-muted-foreground">Internal Operations</div>
            </div>
          </div>
          <IconButton label="Close navigation" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
          {adminNavGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <div className="px-2 text-xs font-medium text-muted-foreground">{group.title}</div>
              {group.items.map((item) => {
                const active = location.pathname === item.href
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex h-8 items-center gap-2 rounded-md px-2 text-sm font-normal transition',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        <div className="p-2">
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent p-3">
            <div className="text-sm font-medium">Platform session</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              API auth guard lands in Phase 4 after `/api/v1/admin/auth/me`.
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
