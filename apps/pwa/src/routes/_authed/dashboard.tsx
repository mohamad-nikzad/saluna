import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Scissors,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import type { DashboardData } from '@repo/api-client'

import { api } from '#/lib/api-client'
import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'
import { dashboardQueryKey } from '#/lib/query-keys'

export const Route = createFileRoute('/_authed/dashboard')({
  beforeLoad: ({ context }) => {
    const user = context.user
    if (user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData<DashboardData>({
      queryKey: dashboardQueryKey,
      queryFn: ({ signal }) => api.dashboard.get({ signal }),
      staleTime: HEAVY_QUERY_STALE_TIME_MS,
    }),
  component: DashboardPage,
  pendingComponent: DashboardPending,
  errorComponent: DashboardError,
})

function DashboardPending() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  )
}

function DashboardError({ error }: { error: Error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">داشبورد بارگذاری نشد</p>
      <p className="text-xs text-destructive">{error.message}</p>
    </div>
  )
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('fa-IR').format(n)
}

function formatPrice(n: number) {
  return `${new Intl.NumberFormat('fa-IR').format(n)} تومان`
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-muted-foreground',
  confirmed: 'bg-primary',
  completed: 'bg-green-500',
  cancelled: 'bg-destructive',
  'no-show': 'bg-orange-500',
}

const BAR_COLORS = [
  'bg-primary',
  'bg-green-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
]

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ElementType
  subtitle?: string
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {title}
            </p>
            <p className="break-words text-xl font-bold tracking-tight sm:text-2xl">
              {value}
            </p>
            {subtitle ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
  const initial = Route.useLoaderData()
  const { data } = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: ({ signal }) => api.dashboard.get({ signal }),
    initialData: initial,
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
    refetchInterval: HEAVY_QUERY_STALE_TIME_MS,
  })

  const maxServiceCount = Math.max(
    ...data.popularServices.map((s) => s.count),
    1,
  )
  const maxStaffCount = Math.max(...data.staffLoad.map((s) => s.count), 1)

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border/50 bg-card px-3 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="بازگشت"
          onClick={() => navigate({ to: '/settings' })}
          className="h-10 w-10 shrink-0 rounded-2xl touch-manipulation"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">داشبورد</h1>
          <p className="truncate text-xs text-muted-foreground">
            آمار و گزارش‌های سالن
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-auto p-4 pb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            title="نوبت‌های امروز"
            value={formatNumber(data.todayAppointments)}
            icon={CalendarCheck}
          />
          <StatCard
            title="نوبت‌های هفته"
            value={formatNumber(data.weekAppointments)}
            icon={CalendarClock}
          />
          <StatCard
            title="نوبت‌های ماه"
            value={formatNumber(data.monthAppointments)}
            icon={CalendarDays}
          />
          <StatCard
            title="درآمد ماه"
            value={formatPrice(data.monthRevenue)}
            icon={Banknote}
            subtitle="نوبت‌های انجام‌شده"
          />
          <StatCard
            title="کل مشتریان"
            value={formatNumber(data.totalClients)}
            icon={Users}
            subtitle={
              data.newClientsThisMonth > 0
                ? `${formatNumber(data.newClientsThisMonth)} مشتری جدید این ماه`
                : undefined
            }
          />
          <StatCard
            title="پرسنل فعال"
            value={formatNumber(data.totalStaff)}
            icon={UserPlus}
          />
        </div>

        {data.todayStatusBreakdown.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                وضعیت نوبت‌های امروز
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.todayStatusBreakdown.map((item) => {
                const meta = APPOINTMENT_STATUS[item.status]
                return (
                  <Badge
                    key={item.status}
                    variant="secondary"
                    className={`text-xs gap-1.5 px-2.5 py-1 ${meta.color}`}
                  >
                    <span className="font-bold">
                      {formatNumber(item.count)}
                    </span>
                    {meta.label}
                  </Badge>
                )
              })}
            </CardContent>
          </Card>
        )}

        {data.popularServices.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Scissors className="h-4 w-4" />
                پرطرفدارترین خدمات این ماه
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.popularServices.map((svc, i) => (
                <div key={svc.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{svc.name}</span>
                    <span className="mr-2 shrink-0 text-xs text-muted-foreground">
                      {formatNumber(svc.count)} نوبت
                    </span>
                  </div>
                  <ProgressBar
                    value={svc.count}
                    max={maxServiceCount}
                    color={BAR_COLORS[i % BAR_COLORS.length]}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.staffLoad.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                عملکرد پرسنل این ماه
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.staffLoad.map((staff) => (
                <div key={staff.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{staff.name}</span>
                    <span className="mr-2 shrink-0 text-xs text-muted-foreground">
                      {formatNumber(staff.count)} نوبت
                    </span>
                  </div>
                  <ProgressBar
                    value={staff.count}
                    max={maxStaffCount}
                    color="bg-primary"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.monthStatusBreakdown.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                وضعیت کلی نوبت‌های ماه
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {data.monthStatusBreakdown.map((item) => {
                  const total = data.monthStatusBreakdown.reduce(
                    (sum, i) => sum + i.count,
                    0,
                  )
                  const pct = total > 0 ? (item.count / total) * 100 : 0
                  return (
                    <div
                      key={item.status}
                      className={`${STATUS_COLORS[item.status] ?? 'bg-muted'} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  )
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {data.monthStatusBreakdown.map((item) => {
                  const label = APPOINTMENT_STATUS[item.status].label
                  return (
                    <div
                      key={item.status}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          STATUS_COLORS[item.status] ?? 'bg-muted'
                        }`}
                      />
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">
                        {formatNumber(item.count)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
