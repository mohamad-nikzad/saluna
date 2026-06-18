import { getApiV1AdminOverviewOptions } from '@repo/api-client/query'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Archive,
  CircleAlert,
  FileClock,
  MessageSquareWarning,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

export function OverviewPage() {
  return (
    <>
      <AdminPageHeader
        title="نمای کلی"
        description="وضعیت پلتفرم، سلامت سالن‌ها و آخرین رویدادهای حاکمیتی."
      />
      <OverviewScreen />
    </>
  )
}

export function OverviewScreen() {
  const overviewQuery = useQuery(getApiV1AdminOverviewOptions())
  const data = overviewQuery.data
  const cards = [
    {
      label: 'سالن‌های فعال',
      value: data?.salonsByStatus.active ?? 0,
      icon: Activity,
      tone: 'success',
      hint: `${data?.salonsByStatus.suspended ?? 0} تعلیق‌شده`,
    },
    {
      label: 'سالن‌های آرشیوشده',
      value: data?.salonsByStatus.archived ?? 0,
      icon: Archive,
      tone: 'default',
      hint: 'خارج از جریان کاری سالن‌ها',
    },
    {
      label: 'ارسال‌های ناموفق',
      value: data?.failedDeliveries ?? 0,
      icon: CircleAlert,
      tone: 'warning',
      hint: 'خطاهای ارسال اعلان',
    },
    {
      label: 'رویدادهای ممیزی اخیر',
      value: data?.recentAuditEvents.length ?? 0,
      icon: ShieldCheck,
      tone: 'default',
      hint: 'آخرین فعالیت‌های حاکمیتی',
    },
  ] as const

  if (overviewQuery.isLoading) return <OverviewSkeleton />

  if (overviewQuery.isError) {
    return (
      <ErrorPanel message="دریافت آمار نمای کلی انجام نشد. دوباره تلاش کنید." />
    )
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="min-h-36">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>{card.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground/85" />
              </CardHeader>
              <CardContent className="flex min-h-20 flex-col items-end justify-end">
                <div className="text-4xl font-semibold leading-none tracking-normal">
                  {card.value}
                </div>
                <Badge className="mt-3" variant={card.tone}>
                  {card.hint}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid min-h-32 gap-4 lg:grid-cols-2">
        <Panel
          title="ارائه‌دهنده‌های پیام‌رسانی"
          icon={<MessageSquareWarning className="h-4 w-4" />}
        >
          <CompactRows
            rows={(data?.messagingAccounts ?? []).map((row) => ({
              label: `${text(row.provider)} ${truthy(row.enabled) ? 'فعال' : 'غیرفعال'}`,
              value: String(number(row.value)),
              badge: truthy(row.enabled) ? 'فعال' : 'غیرفعال',
            }))}
            empty="هنوز حساب پیام‌رسانی متصل نشده است."
          />
        </Panel>
        <Panel
          title="رویدادهای ممیزی اخیر"
          icon={<FileClock className="h-4 w-4" />}
        >
          <CompactRows
            rows={(data?.recentAuditEvents ?? []).map((row) => ({
              label: text(row.action),
              value: formatAuditTarget(row),
              badge: formatDate(row.createdAt),
            }))}
            empty="هنوز تغییری توسط ادمین ثبت نشده است."
          />
        </Panel>
      </section>
    </div>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/80 px-4 py-3">
        {icon ? <span className="text-muted-foreground/85">{icon}</span> : null}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function CompactRows({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: string; badge?: string }>
  empty: string
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/35 px-3 py-2.5"
        >
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
      ))}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div
      role="status"
      aria-label="در حال دریافت نمای کلی"
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <Skeleton className="h-5 w-52" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
    </div>
  )
}

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

function number(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

function formatDate(value: unknown): string {
  const raw = text(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatAuditTarget(row: Record<string, unknown>): string {
  const targetType = text(row.targetType)
  const targetId = shortId(row.targetId)
  if (targetType && targetId) return `${targetType} · ${targetId}`
  return targetType || targetId || '-'
}

function shortId(value: unknown) {
  const id = text(value)
  if (!id) return ''
  return id.length > 8 ? id.slice(0, 8) : id
}
