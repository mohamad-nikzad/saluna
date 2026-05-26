import { Link, useRouterState } from '@tanstack/react-router'
import {
  CalendarDays,
  LayoutDashboard,
  Menu,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@repo/ui/utils'

import { useAuth } from '#/lib/auth'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  matchPrefixes?: ReadonlyArray<string>
}

const managerItems: ReadonlyArray<NavItem> = [
  { to: '/today', label: 'امروز', icon: CalendarDays },
  { to: '/dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/clients', label: 'مشتریان', icon: Users },
  {
    to: '/settings',
    label: 'بیشتر',
    icon: Menu,
    matchPrefixes: ['/settings', '/dashboard', '/retention'],
  },
]

const staffItems: ReadonlyArray<NavItem> = [
  { to: '/today', label: 'امروز', icon: CalendarDays },
  { to: '/settings', label: 'تنظیمات', icon: Menu },
]

export function BottomNav() {
  const { user } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items = user?.role === 'manager' ? managerItems : staffItems

  return (
    <nav className="shrink-0 border-t border-border/60 bg-card safe-area-pb">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const prefixes = item.matchPrefixes ?? [item.to]
          const isActive = prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition-colors touch-manipulation',
                isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground',
              )}
            >
              <div
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-xl transition-[background-color,transform]',
                  isActive && 'bg-blush-soft',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.7} />
              </div>
              <span className="truncate px-1">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
