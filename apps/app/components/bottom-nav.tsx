'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import {
  Calendar,
  Users,
  Settings,
  CalendarDays,
  Inbox,
  Menu,
} from 'lucide-react'
import { cn } from '@repo/ui/utils'
import { useAuth } from '@/components/auth-provider'

const managerItems = [
  { href: '/today', label: 'امروز', icon: CalendarDays },
  { href: '/calendar', label: 'تقویم', icon: Calendar },
  { href: '/requests', label: 'درخواست‌ها', icon: Inbox },
  { href: '/clients', label: 'مشتریان', icon: Users },
  { href: '/settings', label: 'بیشتر', icon: Menu },
] as const

const staffItems = [
  { href: '/today', label: 'امروز', icon: CalendarDays },
  { href: '/calendar', label: 'تقویم', icon: Calendar },
  { href: '/settings', label: 'تنظیمات', icon: Settings },
] as const

const badgeFetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('failed')
  return res.json() as Promise<{ requests: unknown[] }>
}

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const items = user?.role === 'manager' ? managerItems : staffItems
  const { data: pendingData } = useSWR(
    user?.role === 'manager' ? '/api/appointment-requests?status=pending' : null,
    badgeFetcher,
    { refreshInterval: 60_000 },
  )
  const pendingCount = pendingData?.requests?.length ?? 0

  return (
    <nav className="shrink-0 border-t border-border/60 bg-card safe-area-pb">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const isActive =
            item.href === '/clients'
              ? pathname === '/clients' || pathname.startsWith('/clients/')
              : item.href === '/settings'
                ? ['/settings', '/dashboard', '/retention', '/staff', '/services', '/onboarding'].some((path) =>
                    pathname.startsWith(path)
                  )
              : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition-colors touch-manipulation',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground'
              )}
            >
              <div className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-xl transition-[background-color,transform]',
                isActive && 'bg-primary/12'
              )}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.7} />
                {item.href === '/requests' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </div>
              <span className="truncate px-1">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
