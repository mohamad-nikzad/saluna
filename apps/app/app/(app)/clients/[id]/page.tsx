'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ArrowRight,
  Phone,
  CalendarPlus,
  Pencil,
  User,
  ClipboardList,
  Sparkles,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { ClientDrawer } from '@/components/clients/client-drawer'
import { useAuth } from '@/components/auth-provider'
import { ClientSummarySkeleton } from '@/components/skeletons/client-summary-skeleton'
import {
  NetworkStatusBanner,
  OfflineStateCard,
} from '@/components/pwa/offline-state'
import { fetchJsonOrThrow, useNetworkStatus } from '@/lib/pwa-client'
import { useClientSummaryIndexedDbSources } from '@/lib/use-clients-indexeddb'
import type { ClientSummary, FollowUpReason } from '@repo/salon-core/types'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import { formatPersianTime } from '@repo/salon-core/persian-digits'

async function fetcher<T>(url: string) {
  return fetchJsonOrThrow<T>(url)
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

function formatTomans(n: number) {
  return new Intl.NumberFormat('fa-IR').format(n) + ' تومان'
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''
  const { user } = useAuth()
  const isOnline = useNetworkStatus()
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'manager') {
      router.replace('/today')
    }
  }, [user, router])

  const {
    data: liveData,
    error,
    isLoading,
    mutate,
  } = useSWR<ClientSummary>(
    user?.role === 'manager' && id ? `/api/clients/${id}/summary` : null,
    fetcher
  )
  const idb = useClientSummaryIndexedDbSources(
    user?.role === 'manager',
    isOnline,
    id,
    liveData
  )
  const data = idb.data ?? liveData

  if (!user || user.role !== 'manager') return null

  if ((isLoading || idb.idbLoading) && !data) {
    return <ClientSummarySkeleton />
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border/50 bg-card px-3 py-3">
          <Button variant="ghost" size="icon-sm" className="shrink-0 touch-manipulation" asChild>
            <Link href="/clients" aria-label="بازگشت">
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
          onRetry={() => void mutate()}
        />

        <OfflineStateCard
          title="پروفایل مشتری فعلا در دسترس نیست"
          description={
            isOnline
              ? 'بارگذاری پروفایل کامل نشد یا این مشتری پیدا نشد.'
              : 'برای باز کردن این پروفایل باید قبلا یک بار آن را با اینترنت دیده باشید.'
          }
          actionLabel="بازگشت به فهرست"
          onAction={() => router.push('/clients')}
        />
      </div>
    )
  }

  const { client, tags, stats, upcomingAppointment, history, openFollowUps } = data

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border/50 bg-card px-3 py-3">
        <Button variant="ghost" size="icon-sm" className="shrink-0 touch-manipulation" asChild>
          <Link href="/clients" aria-label="بازگشت">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{client.name}</h1>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {displayPhone(client.phone)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="touch-manipulation shrink-0 gap-1"
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
        onRetry={() => void mutate()}
      />

      <div className="flex-1 space-y-3 overflow-auto p-4">
        <div className="flex flex-wrap gap-2">
          {client.phone ? (
            <Button className="touch-manipulation gap-1.5" asChild>
              <a href={`tel:${client.phone}`}>
                <Phone className="h-4 w-4" />
                تماس
              </a>
            </Button>
          ) : null}
          {isOnline ? (
            <Button variant="secondary" className="touch-manipulation gap-1.5" asChild>
              <Link href={`/calendar?clientId=${client.id}`}>
                <CalendarPlus className="h-4 w-4" />
                نوبت جدید
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" className="touch-manipulation gap-1.5" disabled>
              <CalendarPlus className="h-4 w-4" />
              نوبت جدید
            </Button>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="outline" className={tag.color}>
                {tag.label}
              </Badge>
            ))}
          </div>
        )}

        {client.notes && (
          <Card className="border-border/50 border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4" />
                یادداشت
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">{client.notes}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Card className="border-border/50">
            <CardContent className="py-3 text-center">
              <p className="text-[11px] text-muted-foreground">مراجعات انجام‌شده</p>
              <p className="text-xl font-bold">{new Intl.NumberFormat('fa-IR').format(stats.totalCompletedVisits)}</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="py-3 text-center">
              <p className="text-[11px] text-muted-foreground">لغو / غیبت</p>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('fa-IR').format(stats.cancelledCount)} /{' '}
                {new Intl.NumberFormat('fa-IR').format(stats.noShowCount)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/50 col-span-2 sm:col-span-1">
            <CardContent className="py-3 text-center">
              <p className="text-[11px] text-muted-foreground">مجموع تخمینی</p>
              <p className="text-sm font-bold">{formatTomans(stats.estimatedSpend)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Card className="border-border/50">
            <CardContent className="flex items-start gap-2 py-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">محبوب‌ترین خدمت</p>
                <p className="font-medium">{stats.favoriteServiceName ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="flex items-start gap-2 py-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">آخرین پرسنل</p>
                <p className="font-medium">{stats.lastStaffName ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {upcomingAppointment && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">نوبت پیشِ رو</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>{formatJalaliFullDate(upcomingAppointment.date)}</p>
              <p className="text-muted-foreground" dir="ltr">
                {formatPersianTime(upcomingAppointment.startTime)} – {formatPersianTime(upcomingAppointment.endTime)} ·{' '}
                {upcomingAppointment.staff.name}
              </p>
              <p>{upcomingAppointment.bookedServiceName}</p>
              <Badge className="mt-1" variant="secondary">
                {APPOINTMENT_STATUS[upcomingAppointment.status].label}
              </Badge>
            </CardContent>
          </Card>
        )}

        {openFollowUps.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">پیگیری‌های باز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {openFollowUps.map((fu) => (
                <div
                  key={fu.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <span className="text-sm font-medium">{followReasonLabel(fu.reason)}</span>
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link href="/retention">صف پیگیری</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">تاریخچه نوبت‌ها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز نوبتی ثبت نشده است.</p>
            ) : (
              history
                .slice()
                .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`))
                .map((apt) => (
                  <div
                    key={apt.id}
                    className="flex flex-col gap-1 border-b border-border/40 py-2 last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{formatJalaliFullDate(apt.date)}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {APPOINTMENT_STATUS[apt.status].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {apt.bookedServiceName} · {apt.staff.name}{' '}
                      <span dir="ltr" className="ms-1">
                        ({formatPersianTime(apt.startTime)}–{formatPersianTime(apt.endTime)})
                      </span>
                    </p>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <ClientDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSuccess={() => {
          setEditOpen(false)
          void mutate()
        }}
      />
    </div>
  )
}
