import { getApiV1AdminOverviewOptions } from '@repo/api-client/query'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Archive,
  CircleAlert,
  FileClock,
  MessageSquareWarning,
  ShieldCheck,
} from 'lucide-react'
import { CompactRows, Panel } from '#/components/admin/panel'
import { ErrorPanel } from '#/components/admin/error-panel'
import { ScreenSkeleton } from '#/components/admin/screen-skeleton'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { formatDate, number, text } from '#/lib/admin-format'
import { cn } from '#/lib/utils'

export function OverviewPage() {
  return (
    <>
      <AdminPageHeader
        title="نمای کلی"
        description="وضعیت پلتفرم، سلامت سالن‌ها و رویدادهای حاکمیتی اخیر."
      />
      <OverviewScreen />
    </>
  )
}

export function OverviewScreen() {
  const overviewQuery = useQuery(getApiV1AdminOverviewOptions())
  const data = overviewQuery.data
  const cards: Array<{
    label: string
    value: number
    icon: typeof Activity
    tone: 'success' | 'default' | 'warning'
    hint: string
    href?: '/salons' | '/audit-log'
  }> = [
    {
      label: 'سالن‌های فعال',
      value: data?.salonsByStatus.active ?? 0,
      icon: Activity,
      tone: 'success',
      hint: `${data?.salonsByStatus.suspended ?? 0} تعلیق‌شده`,
      href: '/salons',
    },
    {
      label: 'سالن‌های آرشیوشده',
      value: data?.salonsByStatus.archived ?? 0,
      icon: Archive,
      tone: 'default',
      hint: 'خارج از گردش کار سالن‌ها',
      href: '/salons',
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
      href: '/audit-log',
    },
  ]

  if (overviewQuery.isLoading) {
    return <ScreenSkeleton label="در حال بارگذاری نمای کلی" />
  }

  if (overviewQuery.isError) {
    return (
      <ErrorPanel
        message="بارگذاری شاخص‌های نمای کلی ناموفق بود. لطفاً دوباره تلاش کنید."
        onRetry={() => void overviewQuery.refetch()}
      />
    )
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          const content = (
            <Card
              className={cn(
                'min-h-36',
                card.href &&
                  'transition-colors hover:border-primary/35 hover:bg-accent/20',
              )}
            >
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

          if (!card.href) {
            return <div key={card.label}>{content}</div>
          }

          return (
            <Link
              key={card.label}
              to={card.href}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {content}
            </Link>
          )
        })}
      </section>

      <section className="grid min-h-32 gap-4 lg:grid-cols-2">
        <Panel
          title="ارائه‌دهندگان پیام‌رسانی"
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
          action={
            <Link
              to="/audit-log"
              className="text-xs font-medium text-primary hover:underline"
            >
              مشاهده همه
            </Link>
          }
        >
          <CompactRows
            rows={(data?.recentAuditEvents ?? []).map((row) => ({
              label: text(row.action),
              value: formatAuditTarget(row),
              badge: formatDate(row.createdAt),
              href: '/audit-log',
            }))}
            empty="هنوز تغییری توسط مدیر ثبت نشده است."
          />
        </Panel>
      </section>
    </div>
  )
}

function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
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
