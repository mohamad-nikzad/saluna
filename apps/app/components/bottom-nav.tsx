'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Users,
  Settings,
  CalendarDays,
  Menu,
} from 'lucide-react'
import { cn } from '@repo/ui/utils'
import { useAuth } from '@/components/auth-provider'

const managerItems = [
  { href: '/today', label: 'امروز', icon: CalendarDays },
  { href: '/calendar', label: 'تقویم', icon: Calendar },
  { href: '/clients', label: 'مشتریان', icon: Users },
  { href: '/settings', label: 'بیشتر', icon: Menu },
] as const

const staffItems = [
  { href: '/today', label: 'امروز', icon: CalendarDays },
  { href: '/calendar', label: 'تقویم', icon: Calendar },
  { href: '/settings', label: 'تنظیمات', icon: Settings },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const items = user?.role === 'manager' ? managerItems : staffItems

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
                'flex h-8 w-8 items-center justify-center rounded-xl transition-[background-color,transform]',
                isActive && 'bg-primary/12'
              )}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.7} />
              </div>
              <span className="truncate px-1">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
