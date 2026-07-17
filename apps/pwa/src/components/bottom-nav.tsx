import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Banknote,
  CalendarDays,
  CalendarRange,
  Inbox,
  Menu,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@repo/ui/utils'

import { pendingAppointmentRequestsQueryOptions } from '#/lib/appointment-requests-queries'
import { supportTicketSummaryQueryOptions } from '#/lib/support-ticket-queries'
import { useAuth } from '#/lib/auth'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  matchPrefixes?: ReadonlyArray<string>
}

const managerItems: ReadonlyArray<NavItem> = [
  { to: '/today', label: 'امروز', icon: CalendarDays },
  { to: '/calendar', label: 'تقویم', icon: CalendarRange },
  { to: '/requests', label: 'درخواست‌ها', icon: Inbox },
  { to: '/clients', label: 'مشتریان', icon: Users },
  {
    to: '/settings',
    label: 'بیشتر',
    icon: Menu,
    matchPrefixes: [
      '/settings',
      '/dashboard',
      '/retention',
      '/services',
      '/staff',
      '/support',
      '/commissions',
    ],
  },
]

const staffItems: ReadonlyArray<NavItem> = [
  { to: '/today', label: 'امروز', icon: CalendarDays },
  { to: '/calendar', label: 'تقویم', icon: CalendarRange },
  { to: '/earnings', label: 'کمیسیون من', icon: Banknote },
  { to: '/settings', label: 'تنظیمات', icon: Menu },
]

export function BottomNav() {
  const { user } = useAuth()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const items = user?.role === 'manager' ? managerItems : staffItems

  const isManager = user?.role === 'manager'
  const onOnboarding = pathname.startsWith('/onboarding')
  const { data: pendingData } = useQuery({
    ...pendingAppointmentRequestsQueryOptions(),
    enabled: isManager && !onOnboarding,
    refetchInterval: 60_000,
  })
  const pendingCount = pendingData?.requests.length ?? 0
  const { data: supportSummary } = useQuery({
    ...supportTicketSummaryQueryOptions(),
    enabled: isManager && !onOnboarding,
  })
  const supportUnreadCount = supportSummary?.unreadCount ?? 0

  return (
    <nav className="shrink-0 border-t border-border/60 bg-card safe-area-pb">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const prefixes = item.matchPrefixes ?? [item.to]
          const isActive = prefixes.some(
            (p) => pathname === p || pathname.startsWith(`${p}/`),
          )
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition-colors touch-manipulation',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:text-foreground',
              )}
            >
              <div
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-xl transition-[background-color,transform]',
                  isActive && 'bg-blush-soft',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.7} />
                {item.to === '/requests' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 box-content min-w-[16px] h-[16px] px-1 rounded-full border-2 border-card bg-saloora-rose text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
                {item.to === '/settings' &&
                isManager &&
                supportUnreadCount > 0 ? (
                  <span
                    aria-label={`${supportUnreadCount} پیام پشتیبانی خوانده‌نشده`}
                    className="absolute -top-1 -right-1 box-content min-w-[16px] h-[16px] px-1 rounded-full border-2 border-card bg-saloora-rose text-white text-[9px] font-bold flex items-center justify-center tabular-nums"
                  >
                    {toPersianDigits(
                      supportUnreadCount > 99 ? '99+' : supportUnreadCount,
                    )}
                  </span>
                ) : null}
              </div>
              <span className="truncate px-1">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
