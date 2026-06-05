import { useState } from 'react'
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarPlus,
  Check,
  ClipboardList,
  Clock,
  Pencil,
  Phone,
  Sparkles,
  User,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card } from '@repo/ui/card'
import { cn } from '@repo/ui/utils'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import type { ClientSummary, FollowUpReason } from '@repo/salon-core/types'
import {
  JALALI_MONTHS,
  formatJalaliFullDate,
  parseGregorianToJalali,
} from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'

import { api } from '#/lib/api-client'
import { HEAVY_QUERY_STALE_TIME_MS } from '#/lib/query-client'
import { useNetworkStatus } from '#/lib/network-status'
import { managerClientsQueryKey } from '#/lib/query-keys'
import { useClientSummaryIndexedDbSources } from '#/lib/use-clients-indexeddb'
import { ClientDrawer } from '#/components/clients/client-drawer'
import {
  ClientAvatar,
  clientAccent,
  tagTone,
} from '#/components/clients/client-visuals'
import { ClientSummarySkeleton } from '#/components/clients/client-summary-skeleton'
import {
  NetworkStatusBanner,
  OfflineStateCard,
} from '#/components/offline-state'

const clientSummaryKey = (id: string) => ['clients', id, 'summary'] as const

export const Route = createFileRoute('/_authed/clients/$id')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData<ClientSummary>({
      queryKey: clientSummaryKey(params.id),
      queryFn: ({ signal }) => api.clients.summary(params.id, { signal }),
    }),
  component: ClientDetailPage,
  pendingComponent: ClientSummarySkeleton,
  errorComponent: ClientDetailError,
})

function ClientDetailError({ error }: { error: Error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        پروفایل مشتری بارگذاری نشد
      </p>
      <p className="text-xs text-destructive">{error.message}</p>
      <Button asChild variant="outline">
        <Link to="/clients">بازگشت به فهرست</Link>
      </Button>
    </div>
  )
}

function followReasonLabel(reason: FollowUpReason): string {
  switch (reason) {
    case 'inactive':
      return 'عدم مراجعه'
    case 'no-show':
      return 'غیبت'
    case 'new-client':
      return 'مشتری جدید'
    case 'vip':
      return 'ارزشمند'
    case 'manual':
      return 'دستی'
    default:
      return reason
  }
}

function compactToman(n: number): string {
  if (n >= 1_000_000) return `${toPersianDigits((n / 1_000_000).toFixed(1))} م`
  if (n >= 1_000) return `${toPersianDigits(Math.round(n / 1_000))} هـ`
  return toPersianDigits(n)
}

function shortJalali(dateStr: string): string {
  const { jd, jm } = parseGregorianToJalali(dateStr)
  return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]}`
}

function ClientStat({
  label,
  value,
  accent,
  small,
}: {
  label: string
  value: string
  accent: string
  small?: boolean
}) {
  return (
    <div className="flex-1 rounded-2xl border border-line-soft bg-card p-3 text-center">
      <div
        className={cn(
          'font-extrabold tabular-nums tracking-tight',
          small ? 'text-sm' : 'text-xl',
        )}
        style={{ color: accent }}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function ClientDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const initial = Route.useLoaderData()
  const isOnline = useNetworkStatus()
  const [editOpen, setEditOpen] = useState(false)

  const {
    data: liveData,
    error,
    refetch,
  } = useQuery({
    queryKey: clientSummaryKey(id),
    queryFn: ({ signal }) => api.clients.summary(id, { signal }),
    initialData: initial,
    staleTime: HEAVY_QUERY_STALE_TIME_MS,
  })

  const idb = useClientSummaryIndexedDbSources(true, isOnline, id, liveData)
  const data = idb.data ?? liveData

  if (idb.idbLoading && !idb.hasSnapshot && !isOnline) {
    return <ClientSummarySkeleton />
  }

  if (!idb.hasSnapshot && !isOnline && !idb.idbLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-line-soft bg-card px-3 py-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 touch-manipulation"
            asChild
          >
            <Link to="/clients" aria-label="بازگشت">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">پروفایل مشتری</h1>
          </div>
        </header>

        <NetworkStatusBanner
          routeLabel="پروفایل مشتری"
          isOnline={isOnline}
          hasSnapshot={idb.hasSnapshot}
          snapshotUpdatedAt={idb.snapshotUpdatedAt}
          hasError={Boolean(error)}
          onRetry={() => void refetch()}
        />

        <OfflineStateCard
          title="پروفایل مشتری فعلا در دسترس نیست"
          description="برای باز کردن این پروفایل باید قبلا یک بار آن را با اینترنت دیده باشید."
          actionLabel="بازگشت به فهرست"
          onAction={() => navigate({ to: '/clients' })}
        />
      </div>
    )
  }

  const { client, tags, stats, upcomingAppointment, history, openFollowUps } =
    data
  const accent = clientAccent(client, openFollowUps.length > 0)

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-line-soft bg-card px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 touch-manipulation"
          asChild
        >
          <Link to="/clients" aria-label="بازگشت">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <ClientAvatar name={client.name} accent={accent} size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{client.name}</h1>
          <p
            className="truncate text-xs tabular-nums text-muted-foreground"
            dir="ltr"
          >
            {displayPhone(client.phone)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 touch-manipulation gap-1 rounded-xl"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          ویرایش
        </Button>
      </header>

      <NetworkStatusBanner
        routeLabel="پروفایل مشتری"
        isOnline={isOnline}
        hasSnapshot={idb.hasSnapshot}
        snapshotUpdatedAt={idb.snapshotUpdatedAt}
        hasError={Boolean(error)}
        onRetry={() => void refetch()}
      />

      <div className="flex-1 space-y-4 overflow-auto p-4">
        <div className="flex gap-2">
          {client.phone ? (
            <Button className="flex-1 touch-manipulation gap-1.5" asChild>
              <a href={`tel:${client.phone}`}>
                <Phone className="h-4 w-4" />
                تماس
              </a>
            </Button>
          ) : null}
          {isOnline ? (
            <Button
              variant="secondary"
              className="flex-1 touch-manipulation gap-1.5"
              asChild
            >
              <a href={`/calendar?clientId=${client.id}`}>
                <CalendarPlus className="h-4 w-4" />
                نوبت جدید
              </a>
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="flex-1 touch-manipulation gap-1.5"
              disabled
            >
              <CalendarPlus className="h-4 w-4" />
              نوبت جدید
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <ClientStat
            label="مراجعه"
            value={toPersianDigits(stats.totalCompletedVisits)}
            accent="var(--primary)"
          />
          <ClientStat
            label="مجموع خرج"
            value={compactToman(stats.estimatedSpend)}
            accent="var(--mint)"
          />
          <ClientStat
            label="آخرین"
            value={stats.lastVisitDate ? shortJalali(stats.lastVisitDate) : '—'}
            accent="var(--sage-deep)"
            small
          />
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag.id} variant={tagTone(tag.label)}>
                {tag.label}
              </Badge>
            ))}
          </div>
        )}

        {client.notes && (
          <Card className="gap-0 border-amber/40 bg-amber-soft/50 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-fg">
              <ClipboardList className="h-4 w-4" />
              یادداشت
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {client.notes}
            </p>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-2">
          <ClientStat
            label="لغو / غیبت"
            value={`${toPersianDigits(stats.cancelledCount)} / ${toPersianDigits(stats.noShowCount)}`}
            accent="var(--foreground)"
            small
          />
          <div className="flex-1 rounded-2xl border border-line-soft bg-card p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              محبوب‌ترین خدمت
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-foreground">
              {stats.favoriteServiceName ?? '—'}
            </p>
          </div>
          <div className="flex-1 rounded-2xl border border-line-soft bg-card p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <User className="size-3 text-primary" />
              آخرین پرسنل
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-foreground">
              {stats.lastStaffName ?? '—'}
            </p>
          </div>
        </div>

        {upcomingAppointment && (
          <Card className="gap-0 border-primary/30 bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">
                نوبت پیشِ رو
              </span>
              <Badge variant="plum">
                {APPOINTMENT_STATUS[upcomingAppointment.status].label}
              </Badge>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatJalaliFullDate(upcomingAppointment.date)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
              {formatPersianTime(upcomingAppointment.startTime)} –{' '}
              {formatPersianTime(upcomingAppointment.endTime)} ·{' '}
              {upcomingAppointment.staff.name}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {upcomingAppointment.bookedServiceName}
              {upcomingAppointment.bookedAddonCount > 0
                ? ` +${toPersianDigits(upcomingAppointment.bookedAddonCount)}`
                : ''}
            </p>
          </Card>
        )}

        {openFollowUps.length > 0 && (
          <Card className="gap-0 overflow-hidden py-0">
            <div className="px-4 pt-3.5 pb-2 text-sm font-bold text-foreground">
              پیگیری‌های باز
            </div>
            <div className="px-4 pb-3 space-y-2">
              {openFollowUps.map((fu) => (
                <div
                  key={fu.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line-soft px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {followReasonLabel(fu.reason)}
                  </span>
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link to="/retention">صف پیگیری</Link>
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <section>
          <div className="mb-2.5 flex items-center gap-1.5">
            <Clock className="size-4 text-primary" />
            <h2 className="text-[15px] font-bold text-foreground">تاریخچه</h2>
          </div>
          <Card className="gap-0 overflow-hidden py-0">
            {history.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                هنوز نوبتی ثبت نشده است.
              </p>
            ) : (
              history
                .slice()
                .sort((a, b) =>
                  `${b.date} ${b.startTime}`.localeCompare(
                    `${a.date} ${a.startTime}`,
                  ),
                )
                .map((apt, index) => {
                  const isDone = apt.status === 'completed'
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-3',
                        index > 0 && 'border-t border-line-soft',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-xl',
                          isDone
                            ? 'bg-mint-soft text-mint-fg'
                            : 'bg-paper-deep text-sage-deep',
                        )}
                      >
                        {isDone ? (
                          <Check className="size-4" strokeWidth={2.4} />
                        ) : (
                          <Clock className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {apt.bookedServiceName}
                          {apt.bookedAddonCount > 0
                            ? ` +${toPersianDigits(apt.bookedAddonCount)}`
                            : ''}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {shortJalali(apt.date)} · {apt.staff.name}
                        </p>
                      </div>
                      <Badge
                        variant={isDone ? 'mint' : 'neutral'}
                        className="shrink-0"
                      >
                        {APPOINTMENT_STATUS[apt.status].label}
                      </Badge>
                    </div>
                  )
                })
            )}
          </Card>
        </section>
      </div>

      <ClientDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSuccess={() => {
          setEditOpen(false)
          void queryClient.invalidateQueries({ queryKey: clientSummaryKey(id) })
          void queryClient.invalidateQueries({ queryKey: managerClientsQueryKey })
        }}
      />
    </div>
  )
}
