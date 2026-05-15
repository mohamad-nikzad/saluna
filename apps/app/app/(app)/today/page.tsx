'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AlertTriangle, CalendarDays, Clock, Plus, Users } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { Skeleton } from '@repo/ui/skeleton'
import { cn } from '@repo/ui/utils'
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits'
import { addDaysYmd, salonCurrentHm, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import type {
  AppointmentWithDetails,
  Client,
  Service,
  TodayAttentionItem,
  TodayData,
  User,
} from '@repo/salon-core/types'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import { AppointmentDrawer } from '@/components/calendar/appointment-drawer'
import { AvailabilityDrawer } from '@/components/calendar/availability-drawer'
import { useBumpOfflineData, useManagerDataClient } from '@/components/manager-data-client-provider'
import { useAuth } from '@/components/auth-provider'
import {
  NetworkStatusBanner,
  OfflineStateCard,
} from '@/components/pwa/offline-state'
import { fetchJsonOrThrow, useNetworkStatus, useOfflineSnapshot } from '@/lib/pwa-client'
import { useManagerTodayIndexedDbSources } from '@/lib/use-manager-today-indexeddb'
import {
  ManagerTodaySkeleton,
  StaffTodaySkeleton,
} from '@/components/skeletons/today-skeleton'
import { getNextOpenSlot } from './next-open-slot'

async function fetcher<T>(url: string) {
  return fetchJsonOrThrow<T>(url)
}

type StaffResponse = {
  staff: User[]
}

type ServicesResponse = {
  services: Service[]
}

type ClientsResponse = {
  clients: Client[]
}

type GroupedAttentionItem = {
  id: string
  title: string
  detail: string
  clientId?: string
  priority: number
  labels: string[]
}

const ACTIVE_STATUSES = new Set<AppointmentWithDetails['status']>(['scheduled', 'confirmed'])

type StatusActionFeedback = {
  appointmentId: string
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'queued' | 'error'
  message: string
} | null

const ATTENTION_LABELS: Record<TodayAttentionItem['type'], string> = {
  soon: 'نزدیک',
  overdue: 'ثبت نتیجه',
  'no-show-risk': 'بدقول',
  'first-time': 'اولین مراجعه',
  vip: 'VIP',
  'incomplete-client': 'اطلاعات ناقص',
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR').format(value)
}

function sortAppointments(list: AppointmentWithDetails[]) {
  return [...list].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
}

function bookedMinutesFor(appointments: AppointmentWithDetails[]) {
  return appointments.reduce(
    (sum, appointment) => sum + durationMinutesFromRange(appointment.startTime, appointment.endTime),
    0
  )
}

function summarizeOpenRanges(ranges: Array<{ startTime: string; endTime: string }>) {
  if (ranges.length === 0) {
    return 'بازه آزاد ندارد'
  }

  const first = ranges[0]
  const primary = `${formatPersianTime(first.startTime)} تا ${formatPersianTime(first.endTime)}`
  if (ranges.length === 1) {
    return primary
  }

  return `${primary} · ${toPersianDigits(ranges.length - 1)} بازه دیگر`
}

function summarizeNextOpenSlot(slot: ReturnType<typeof getNextOpenSlot>) {
  if (!slot) {
    return 'بازه آزاد دیگری ندارد'
  }

  const primary = slot.startsNow
    ? `از الان تا ${formatPersianTime(slot.endTime)}`
    : `${formatPersianTime(slot.startTime)} تا ${formatPersianTime(slot.endTime)}`

  if (slot.additionalRanges === 0) {
    return primary
  }

  return `${primary} · ${toPersianDigits(slot.additionalRanges)} بازه دیگر`
}

function groupAttentionItems(items: TodayAttentionItem[]) {
  const grouped = new Map<string, GroupedAttentionItem>()

  for (const item of items) {
    const key = item.appointmentId ?? item.clientId ?? item.id
    const label = ATTENTION_LABELS[item.type]
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, {
        id: key,
        title: item.title,
        detail: item.detail,
        clientId: item.clientId,
        priority: item.priority,
        labels: [label],
      })
      continue
    }

    if (!existing.labels.includes(label)) {
      existing.labels.push(label)
    }

    if (item.priority < existing.priority) {
      existing.priority = item.priority
      existing.title = item.title
      existing.detail = item.detail
    }
  }

  return [...grouped.values()].sort((a, b) => a.priority - b.priority)
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="space-y-1 py-4">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function AppointmentCard({
  appointment,
  meta,
  tone = 'default',
  children,
}: {
  appointment: AppointmentWithDetails
  meta: string
  tone?: 'default' | 'highlight'
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm',
        tone === 'highlight' && 'border-primary/30 bg-primary/5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{appointment.client.name}</p>
            {appointment.client.isPlaceholder ? (
              <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-[10px] text-amber-800">
                اطلاعات ناقص
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{appointment.bookedServiceName}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {formatPersianTime(appointment.startTime)} - {formatPersianTime(appointment.endTime)} · {meta}
          </p>
          {appointment.notes ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{appointment.notes}</p>
          ) : null}
        </div>
        <Badge
          variant="outline"
          className={cn('shrink-0 whitespace-nowrap text-[10px]', APPOINTMENT_STATUS[appointment.status].color)}
        >
          {APPOINTMENT_STATUS[appointment.status].label}
        </Badge>
      </div>
      {children}
    </div>
  )
}

function AppointmentActionButtons({
  appointment,
  role,
  feedback,
  isOnline,
  onPatchStatus,
}: {
  appointment: AppointmentWithDetails
  role: 'manager' | 'staff'
  feedback: StatusActionFeedback
  isOnline: boolean
  onPatchStatus: (appointmentId: string, status: AppointmentWithDetails['status']) => void
}) {
  const currentFeedback = feedback?.appointmentId === appointment.id ? feedback : null
  const isSaving = currentFeedback?.mode === 'saving'
  const canActOnVisit = ACTIVE_STATUSES.has(appointment.status)
  const networkBlocked = !isOnline && role === 'staff'

  if (!canActOnVisit) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {appointment.status === 'scheduled' ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 touch-manipulation text-xs"
            disabled={isSaving || networkBlocked}
            onClick={() => onPatchStatus(appointment.id, 'confirmed')}
          >
            {isSaving && currentFeedback?.status === 'confirmed' && <Spinner className="ml-1.5 size-3" />}
            تایید
          </Button>
        ) : null}
        <Button
          size="sm"
          className="h-8 touch-manipulation text-xs"
          disabled={isSaving || networkBlocked}
          onClick={() => onPatchStatus(appointment.id, 'completed')}
        >
          {isSaving && currentFeedback?.status === 'completed' && <Spinner className="ml-1.5 size-3" />}
          انجام شد
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 touch-manipulation text-xs"
          disabled={isSaving || networkBlocked}
          onClick={() => onPatchStatus(appointment.id, 'no-show')}
        >
          {isSaving && currentFeedback?.status === 'no-show' && <Spinner className="ml-1.5 size-3" />}
          غیبت
        </Button>
        {role === 'manager' ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 touch-manipulation text-xs text-destructive"
            disabled={isSaving || networkBlocked}
            onClick={() => onPatchStatus(appointment.id, 'cancelled')}
          >
            {isSaving && currentFeedback?.status === 'cancelled' && <Spinner className="ml-1.5 size-3" />}
            لغو
          </Button>
        ) : null}
      </div>
      {currentFeedback && currentFeedback.mode !== 'saving' && (
        <p
          className={cn(
            'rounded-xl border px-2.5 py-1.5 text-xs',
            currentFeedback.mode === 'error'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : currentFeedback.mode === 'queued'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'
          )}
        >
          {currentFeedback.message}
        </p>
      )}
    </div>
  )
}

function StatusFeedbackBanner({ feedback }: { feedback: StatusActionFeedback }) {
  if (!feedback || feedback.mode === 'saving') return null

  return (
    <p
      className={cn(
        'rounded-2xl border px-3 py-2 text-xs shadow-sm',
        feedback.mode === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : feedback.mode === 'queued'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100'
            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'
      )}
    >
      {feedback.message}
    </p>
  )
}

function ManagerTodayView({
  date,
  setDate,
  data,
  isLoading,
  error,
  snapshotUpdatedAt,
  hasSnapshot,
  isOnline,
  mutateToday,
  staff,
  services,
  clients,
  onRefreshResources,
}: {
  date: string
  setDate: (date: string) => void
  data?: TodayData
  isLoading: boolean
  error: unknown
  snapshotUpdatedAt?: string | null
  hasSnapshot: boolean
  isOnline: boolean
  mutateToday: () => void
  staff: User[]
  services: Service[]
  clients: Client[]
  onRefreshResources: () => void
}) {
  const router = useRouter()
  const dataClient = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const [statusFeedback, setStatusFeedback] = useState<StatusActionFeedback>(null)
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [showAvailabilityDrawer, setShowAvailabilityDrawer] = useState(false)
  const [createDate, setCreateDate] = useState(date)
  const [createTime, setCreateTime] = useState('09:00')
  const [initialStaffIdForCreate, setInitialStaffIdForCreate] = useState<string | undefined>(undefined)
  const [initialServiceIdForCreate, setInitialServiceIdForCreate] = useState<string | undefined>(undefined)
  const createReady = staff.length > 0 && services.length > 0
  const availabilityReady = createReady && isOnline

  const activeAppointments = useMemo(() => {
    if (!data) return []
    return sortAppointments(
      data.appointments.filter((appointment) => ACTIVE_STATUSES.has(appointment.status))
    )
  }, [data])

  const attentionItems = useMemo(
    () => (data ? groupAttentionItems(data.attentionItems).slice(0, 5) : []),
    [data]
  )

  const teamRows = useMemo(() => {
    if (!data) return []
    return data.staffLoad.map((row) => ({
      ...row,
      openSlotSummary: summarizeOpenRanges(
        data.openSlots.find((slot) => slot.staffId === row.staffId)?.ranges ?? []
      ),
    }))
  }, [data])

  const totalAppointments = data
    ? Object.values(data.counts).reduce((sum, count) => sum + count, 0)
    : 0
  const defaultCreateTime =
    data?.openSlots
      .flatMap((slot) => slot.ranges.map((range) => range.startTime))
      .sort()[0] ?? '09:00'

  const quickStats = [
    {
      label: 'کل نوبت‌ها',
      value: formatNumber(totalAppointments),
      hint: data ? formatJalaliFullDate(data.date) : '',
    },
    {
      label: 'در صف امروز',
      value: formatNumber(activeAppointments.length),
      hint: 'رزرو شده و تایید شده',
    },
    {
      label: 'انجام شده',
      value: formatNumber(data?.counts.completed ?? 0),
      hint: 'ثبت نتیجه شده',
    },
    {
      label: 'لغو یا غیبت',
      value: formatNumber((data?.counts.cancelled ?? 0) + (data?.counts['no-show'] ?? 0)),
      hint: 'برای پیگیری سریع',
    },
  ]

  const handleRetry = () => {
    mutateToday()
    onRefreshResources()
  }

  const handleOpenCreateDrawer = () => {
    setInitialStaffIdForCreate(undefined)
    setInitialServiceIdForCreate(undefined)
    setCreateDate(date)
    setCreateTime(defaultCreateTime)
    setShowCreateDrawer(true)
  }

  const handlePatchStatus = async (
    appointmentId: string,
    status: AppointmentWithDetails['status']
  ) => {
    if (!isOnline && !dataClient) return

    setStatusFeedback({
      appointmentId,
      status,
      mode: 'saving',
      message: 'در حال ثبت وضعیت...',
    })
    try {
      if (dataClient) {
        const result = await dataClient.appointments.updateStatus(appointmentId, status)
        void dataClient.sync.processPending()
        bumpOfflineData()
        setStatusFeedback({
          appointmentId,
          status,
          mode: isOnline ? 'saved' : 'queued',
          message:
            result.type === 'deleted'
              ? isOnline
                ? 'رزرو موقت لغو و حذف شد.'
                : 'لغو رزرو موقت آفلاین ثبت شد و بعدا همگام می‌شود.'
              : isOnline
                ? 'وضعیت ثبت شد.'
                : 'آفلاین ثبت شد و بعدا همگام می‌شود.',
        })
        mutateToday()
        return
      }
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setStatusFeedback({
          appointmentId,
          status,
          mode: 'error',
          message: typeof payload.error === 'string' ? payload.error : 'تغییر وضعیت انجام نشد.',
        })
        return
      }
      const payload = await res.json().catch(() => ({}))
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'saved',
        message:
          typeof payload.removedAppointmentId === 'string'
            ? 'رزرو موقت لغو و حذف شد.'
            : 'وضعیت ثبت شد.',
      })
      mutateToday()
    } catch (err) {
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'error',
        message: err instanceof Error ? err.message : 'خطایی رخ داد. دوباره تلاش کنید.',
      })
    }
  }

  const handleAvailabilitySlotSelect = (selection: {
    slot: {
      date: string
      startTime: string
      staffId: string
    }
    serviceId: string
  }) => {
    setShowAvailabilityDrawer(false)
    setCreateDate(selection.slot.date)
    setCreateTime(selection.slot.startTime)
    setInitialStaffIdForCreate(selection.slot.staffId)
    setInitialServiceIdForCreate(selection.serviceId)
    requestAnimationFrame(() => setShowCreateDrawer(true))
  }

  const handleCreateDrawerOpenChange = (nextOpen: boolean) => {
    setShowCreateDrawer(nextOpen)
    if (!nextOpen) {
      setInitialStaffIdForCreate(undefined)
      setInitialServiceIdForCreate(undefined)
    }
  }

  const handleAppointmentCreated = (appointment: AppointmentWithDetails) => {
    setShowCreateDrawer(false)
    setInitialStaffIdForCreate(undefined)
    setInitialServiceIdForCreate(undefined)
    bumpOfflineData()
    if (appointment.date !== date) {
      router.push(`/calendar?date=${appointment.date}`)
      return
    }
    mutateToday()
  }

  if (!data && isLoading) {
    return <ManagerTodaySkeleton />
  }

  if (!data && !isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="border-b border-border/50 bg-card px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-bold">امروز</h1>
                <p className="text-xs text-muted-foreground">نمای سریع سالن و نوبت‌ها</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="touch-manipulation gap-1"
                disabled={(!isOnline && !dataClient) || !createReady}
                onClick={handleOpenCreateDrawer}
              >
                <Plus className="h-4 w-4" />
                نوبت جدید
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="touch-manipulation"
                disabled={!availabilityReady}
                onClick={() => setShowAvailabilityDrawer(true)}
              >
                بررسی زمان خالی
              </Button>
              <Button variant="outline" size="sm" className="touch-manipulation" asChild>
                <Link href={`/calendar?date=${date}`}>تقویم</Link>
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <JalaliDatePicker value={date} onChange={setDate} />
          </div>
        </header>

        <NetworkStatusBanner
          routeLabel="نمای امروز"
          isOnline={isOnline}
          hasSnapshot={hasSnapshot}
          snapshotUpdatedAt={snapshotUpdatedAt}
          hasError={Boolean(error)}
          onRetry={handleRetry}
        />

        <OfflineStateCard
          title="نمای امروز فعلا در دسترس نیست"
          description={
            isOnline
              ? 'بارگذاری اطلاعات امروز کامل نشد. دوباره تلاش کنید.'
              : 'برای اولین بارگذاری این بخش باید دوباره به اینترنت متصل شوید.'
          }
          onAction={handleRetry}
        />

        <AvailabilityDrawer
          open={showAvailabilityDrawer}
          onOpenChange={setShowAvailabilityDrawer}
          initialDate={date}
          staff={staff}
          services={services}
          onSelectSlot={handleAvailabilitySlotSelect}
        />

        <AppointmentDrawer
          open={showCreateDrawer}
          onOpenChange={handleCreateDrawerOpenChange}
          initialDate={createDate}
          initialTime={createTime}
          initialStaffId={initialStaffIdForCreate}
          initialServiceId={initialServiceIdForCreate}
          staff={staff}
          services={services}
          clients={clients}
          onSuccess={handleAppointmentCreated}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border/50 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold">امروز</h1>
              <p className="text-xs text-muted-foreground">
                {data ? formatJalaliFullDate(data.date) : 'در حال بارگذاری'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="touch-manipulation gap-1"
              disabled={(!isOnline && !dataClient) || !createReady}
              onClick={handleOpenCreateDrawer}
            >
              <Plus className="h-4 w-4" />
              نوبت جدید
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="touch-manipulation"
              disabled={!availabilityReady}
              onClick={() => setShowAvailabilityDrawer(true)}
            >
              بررسی زمان خالی
            </Button>
            <Button variant="outline" size="sm" className="touch-manipulation" asChild>
              <Link href={`/calendar?date=${date}`}>تقویم</Link>
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <JalaliDatePicker value={date} onChange={setDate} />
        </div>
      </header>

      <NetworkStatusBanner
        routeLabel="نمای امروز"
        isOnline={isOnline}
        hasSnapshot={hasSnapshot}
        snapshotUpdatedAt={snapshotUpdatedAt}
        hasError={Boolean(error)}
        onRetry={handleRetry}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
            <StatusFeedbackBanner feedback={statusFeedback} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickStats.map((item) => (
                <StatCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  hint={item.hint}
                />
              ))}
            </div>

            {attentionItems.length > 0 ? (
              <Card className="border-amber-200/70 bg-amber-50/70 shadow-sm dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    نیاز به توجه
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {attentionItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/50 bg-card/85 p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {item.labels.map((label) => (
                            <Badge key={label} variant="secondary" className="text-[10px]">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {item.clientId ? (
                        <Button variant="link" className="mt-1 h-auto p-0 text-xs" asChild>
                          <Link href={`/clients/${item.clientId}`}>پروفایل مشتری</Link>
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  صف فعال امروز
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeAppointments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      نوبت فعال برای این روز وجود ندارد.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 touch-manipulation gap-1"
                      disabled={(!isOnline && !dataClient) || !createReady}
                      onClick={handleOpenCreateDrawer}
                    >
                      <Plus className="h-4 w-4" />
                      افزودن نوبت
                    </Button>
                  </div>
                ) : (
                  activeAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      meta={appointment.staff.name}
                    >
                      <AppointmentActionButtons
                        appointment={appointment}
                        role="manager"
                        feedback={statusFeedback}
                        isOnline={isOnline}
                        onPatchStatus={handlePatchStatus}
                      />
                    </AppointmentCard>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  خلاصه تیم
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">اطلاعاتی برای نمایش وجود ندارد.</p>
                ) : (
                  teamRows.map((row) => (
                    <div
                      key={row.staffId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 shadow-sm"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold">{row.staffName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(row.appointmentCount)} نوبت · {formatNumber(row.bookedMinutes)} دقیقه
                        </p>
                      </div>
                      <Badge variant="outline" className="max-w-[52%] whitespace-normal text-right text-[10px]">
                        {row.openSlotSummary}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
      </div>

      <AvailabilityDrawer
        open={showAvailabilityDrawer}
        onOpenChange={setShowAvailabilityDrawer}
        initialDate={date}
        staff={staff}
        services={services}
        onSelectSlot={handleAvailabilitySlotSelect}
      />

      <AppointmentDrawer
        open={showCreateDrawer}
        onOpenChange={handleCreateDrawerOpenChange}
        initialDate={createDate}
        initialTime={createTime}
        initialStaffId={initialStaffIdForCreate}
        initialServiceId={initialServiceIdForCreate}
        staff={staff}
        services={services}
        clients={clients}
        onSuccess={handleAppointmentCreated}
        onClientsChanged={onRefreshResources}
      />
    </div>
  )
}

function StaffTodayView({
  todayDate,
  tomorrowDate,
  todayData,
  tomorrowData,
  todayLoading,
  tomorrowLoading,
  todayError,
  tomorrowError,
  todaySnapshotUpdatedAt,
  tomorrowSnapshotUpdatedAt,
  hasTodaySnapshot,
  hasTomorrowSnapshot,
  isOnline,
  mutateToday,
  mutateTomorrow,
}: {
  todayDate: string
  tomorrowDate: string
  todayData?: TodayData
  tomorrowData?: TodayData
  todayLoading: boolean
  tomorrowLoading: boolean
  todayError: unknown
  tomorrowError: unknown
  todaySnapshotUpdatedAt?: string | null
  tomorrowSnapshotUpdatedAt?: string | null
  hasTodaySnapshot: boolean
  hasTomorrowSnapshot: boolean
  isOnline: boolean
  mutateToday: () => void
  mutateTomorrow: () => void
}) {
  const [statusFeedback, setStatusFeedback] = useState<StatusActionFeedback>(null)
  const [clockHm, setClockHm] = useState(() => salonCurrentHm())

  useEffect(() => {
    const timer = window.setInterval(() => setClockHm(salonCurrentHm()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const todayAppointments = useMemo(
    () => sortAppointments(todayData?.appointments ?? []),
    [todayData]
  )
  const tomorrowAppointments = useMemo(
    () =>
      sortAppointments(
        (tomorrowData?.appointments ?? []).filter((appointment) => appointment.status !== 'cancelled')
      ),
    [tomorrowData]
  )

  const activeTodayAppointments = useMemo(
    () => todayAppointments.filter((appointment) => ACTIVE_STATUSES.has(appointment.status)),
    [todayAppointments]
  )

  const currentAppointment =
    activeTodayAppointments.find(
      (appointment) => appointment.startTime <= clockHm && appointment.endTime > clockHm
    ) ?? null

  const nextAppointment =
    activeTodayAppointments.find((appointment) => appointment.startTime > clockHm) ?? null

  const todayOpenRanges = useMemo(() => todayData?.openSlots[0]?.ranges ?? [], [todayData])
  const tomorrowOpenRanges = useMemo(() => tomorrowData?.openSlots[0]?.ranges ?? [], [tomorrowData])
  const nextOpenSlot = useMemo(
    () =>
      getNextOpenSlot({
        todayRanges: todayOpenRanges,
        tomorrowRanges: tomorrowOpenRanges,
        clockHm,
      }),
    [clockHm, todayOpenRanges, tomorrowOpenRanges]
  )
  const checkingTomorrowOpenSlots = useMemo(
    () =>
      !getNextOpenSlot({
        todayRanges: todayOpenRanges,
        tomorrowRanges: [],
        clockHm,
      }) &&
      tomorrowLoading &&
      !tomorrowData,
    [clockHm, todayOpenRanges, tomorrowData, tomorrowLoading]
  )
  const todayBookedMinutes = bookedMinutesFor(
    todayAppointments.filter((appointment) => appointment.status !== 'cancelled')
  )

  const handleRetry = () => {
    mutateToday()
    mutateTomorrow()
  }

  const handlePatchStatus = async (
    appointmentId: string,
    status: AppointmentWithDetails['status']
  ) => {
    if (!isOnline) {
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'error',
        message: 'برای تغییر وضعیت باید آنلاین باشید.',
      })
      return
    }

    setStatusFeedback({
      appointmentId,
      status,
      mode: 'saving',
      message: 'در حال ثبت وضعیت...',
    })
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        setStatusFeedback({
          appointmentId,
          status,
          mode: 'error',
          message: typeof payload.error === 'string' ? payload.error : 'تغییر وضعیت انجام نشد.',
        })
        return
      }
      const payload = await res.json().catch(() => ({}))
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'saved',
        message:
          typeof payload.removedAppointmentId === 'string'
            ? 'رزرو موقت لغو و حذف شد.'
            : 'وضعیت ثبت شد.',
      })
      mutateToday()
    } catch (err) {
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'error',
        message: err instanceof Error ? err.message : 'خطایی رخ داد. دوباره تلاش کنید.',
      })
    }
  }

  if (!todayData && todayLoading) {
    return <StaffTodaySkeleton />
  }

  if (!todayData && !todayLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="border-b border-border/50 bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-bold">امروز من</h1>
                <p className="text-xs text-muted-foreground">مرور سریع نوبت‌های امروز و فردا</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="touch-manipulation" asChild>
              <Link href={`/calendar?date=${todayDate}`}>تقویم</Link>
            </Button>
          </div>
        </header>

        <NetworkStatusBanner
          routeLabel="برنامه من"
          isOnline={isOnline}
          hasSnapshot={hasTodaySnapshot || hasTomorrowSnapshot}
          snapshotUpdatedAt={todaySnapshotUpdatedAt ?? tomorrowSnapshotUpdatedAt}
          hasError={Boolean(todayError || tomorrowError)}
          onRetry={handleRetry}
        />

        <OfflineStateCard
          title="برنامه امروز فعلا در دسترس نیست"
          description={
            isOnline
              ? 'بارگذاری برنامه شما کامل نشد. دوباره تلاش کنید.'
              : 'برای اولین بارگذاری این بخش باید دوباره به اینترنت متصل شوید.'
          }
          onAction={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border/50 bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold">امروز من</h1>
              <p className="text-xs text-muted-foreground">
                {todayData ? formatJalaliFullDate(todayData.date) : formatJalaliFullDate(todayDate)} · اکنون {formatPersianTime(clockHm)}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="touch-manipulation" asChild>
            <Link href={`/calendar?date=${todayDate}`}>تقویم</Link>
          </Button>
        </div>
      </header>

      <NetworkStatusBanner
        routeLabel="برنامه من"
        isOnline={isOnline}
        hasSnapshot={hasTodaySnapshot || hasTomorrowSnapshot}
        snapshotUpdatedAt={todaySnapshotUpdatedAt ?? tomorrowSnapshotUpdatedAt}
        hasError={Boolean(todayError || tomorrowError)}
        onRetry={handleRetry}
      />

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
            <StatusFeedbackBanner feedback={statusFeedback} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="کل امروز"
                value={formatNumber(todayAppointments.length)}
                hint="همه نوبت‌های ثبت شده"
              />
              <StatCard
                label="در جریان"
                value={formatNumber(activeTodayAppointments.length)}
                hint="رزرو شده و تایید شده"
              />
              <StatCard
                label="زمان رزرو"
                value={formatNumber(todayBookedMinutes)}
                hint="دقیقه کاری امروز"
              />
              <StatCard
                label="فردا"
                value={formatNumber(tomorrowAppointments.length)}
                hint={tomorrowData ? formatJalaliFullDate(tomorrowData.date) : formatJalaliFullDate(tomorrowDate)}
              />
            </div>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  الان و بعدی
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentAppointment ? (
                  <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-primary/12 text-primary hover:bg-primary/12">در حال انجام</Badge>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {formatPersianTime(currentAppointment.startTime)} - {formatPersianTime(currentAppointment.endTime)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{currentAppointment.client.name}</p>
                    <p className="text-xs text-muted-foreground">{currentAppointment.bookedServiceName}</p>
                  </div>
                ) : nextAppointment ? (
                  <div className="space-y-2 rounded-2xl border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">بعدی</Badge>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {formatPersianTime(nextAppointment.startTime)} - {formatPersianTime(nextAppointment.endTime)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{nextAppointment.client.name}</p>
                    <p className="text-xs text-muted-foreground">{nextAppointment.bookedServiceName}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      برای ادامه امروز نوبت فعالی باقی نمانده است.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl bg-muted/60 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">بازه آزاد بعدی</p>
                    {nextOpenSlot ? (
                      <Badge variant="outline" className="text-[10px]">
                        {nextOpenSlot.dayLabel}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {checkingTomorrowOpenSlots
                      ? 'در حال بررسی اولین بازه آزاد...'
                      : summarizeNextOpenSlot(nextOpenSlot)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">نوبت‌های امروز</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">برای امروز نوبتی ثبت نشده است.</p>
                ) : (
                  todayAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      meta={appointment.status === 'completed' ? 'انجام شده' : 'مشتری امروز'}
                      tone={currentAppointment?.id === appointment.id ? 'highlight' : 'default'}
                    >
                      <AppointmentActionButtons
                        appointment={appointment}
                        role="staff"
                        feedback={statusFeedback}
                        isOnline={isOnline}
                        onPatchStatus={handlePatchStatus}
                      />
                    </AppointmentCard>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm">نگاه به فردا</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 touch-manipulation text-xs" asChild>
                  <Link href={`/calendar?date=${tomorrowDate}`}>باز کردن در تقویم</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {!tomorrowData && tomorrowLoading ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border/60 p-3 shadow-sm">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 p-3 shadow-sm">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  </div>
                ) : tomorrowAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">برای فردا هنوز نوبتی ثبت نشده است.</p>
                ) : (
                  tomorrowAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      meta="برنامه فردا"
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  )
}

export default function TodayPage() {
  const { user } = useAuth()
  const isOnline = useNetworkStatus()
  const initialToday = useMemo(() => salonTodayYmd(), [])
  const [managerDate, setManagerDate] = useState(initialToday)

  const managerKey = user?.role === 'manager' ? `/api/today?date=${managerDate}` : null
  const {
    data: managerLiveData,
    error: managerError,
    isLoading: managerLoading,
    mutate: mutateManagerToday,
  } = useSWR<TodayData>(managerKey, fetcher, { keepPreviousData: true })
  const {
    data: staffDirectoryData,
    mutate: mutateStaffDirectory,
  } = useSWR<StaffResponse>(user?.role === 'manager' ? '/api/staff' : null, fetcher)
  const {
    data: servicesData,
    mutate: mutateServices,
  } = useSWR<ServicesResponse>(user?.role === 'manager' ? '/api/services' : null, fetcher)
  const {
    data: clientsData,
    mutate: mutateClients,
  } = useSWR<ClientsResponse>(user?.role === 'manager' ? '/api/clients' : null, fetcher)

  const staffTodayDate = initialToday
  const staffTomorrowDate = useMemo(() => addDaysYmd(initialToday, 1), [initialToday])

  const staffTodayKey = user?.role === 'staff' ? `/api/today?date=${staffTodayDate}` : null
  const staffTomorrowKey = user?.role === 'staff' ? `/api/today?date=${staffTomorrowDate}` : null

  const {
    data: staffTodayLiveData,
    error: staffTodayError,
    isLoading: staffTodayLoading,
    mutate: mutateStaffToday,
  } = useSWR<TodayData>(staffTodayKey, fetcher)
  const {
    data: staffTomorrowLiveData,
    error: staffTomorrowError,
    isLoading: staffTomorrowLoading,
    mutate: mutateStaffTomorrow,
  } = useSWR<TodayData>(staffTomorrowKey, fetcher)

  const staffTodaySnapshot = useOfflineSnapshot(
    staffTodayKey ? `today:staff:${staffTodayDate}` : null,
    staffTodayLiveData
  )
  const staffTomorrowSnapshot = useOfflineSnapshot(
    staffTomorrowKey ? `today:staff:${staffTomorrowDate}` : null,
    staffTomorrowLiveData
  )

  const managerIdb = useManagerTodayIndexedDbSources(
    user?.role === 'manager',
    isOnline,
    managerDate,
    managerLiveData,
    staffDirectoryData?.staff,
    servicesData?.services,
    clientsData?.clients
  )

  if (!user) {
    return null
  }

  if (user.role === 'manager') {
    const managerDisplayData = managerIdb.todayData ?? managerLiveData
    return (
      <ManagerTodayView
        date={managerDate}
        setDate={setManagerDate}
        data={managerDisplayData}
        isLoading={(managerLoading || managerIdb.idbLoading) && !managerDisplayData}
        error={managerError}
        snapshotUpdatedAt={managerIdb.snapshotUpdatedAt}
        hasSnapshot={managerIdb.hasSnapshot}
        isOnline={isOnline}
        mutateToday={() => void mutateManagerToday()}
        staff={managerIdb.staff}
        services={managerIdb.services}
        clients={managerIdb.clients}
        onRefreshResources={() => {
          void mutateStaffDirectory()
          void mutateServices()
          void mutateClients()
        }}
      />
    )
  }

  return (
    <StaffTodayView
      todayDate={staffTodayDate}
      tomorrowDate={staffTomorrowDate}
      todayData={staffTodayLiveData ?? staffTodaySnapshot?.data}
      tomorrowData={staffTomorrowLiveData ?? staffTomorrowSnapshot?.data}
      todayLoading={staffTodayLoading}
      tomorrowLoading={staffTomorrowLoading}
      todayError={staffTodayError}
      tomorrowError={staffTomorrowError}
      todaySnapshotUpdatedAt={staffTodaySnapshot?.updatedAt}
      tomorrowSnapshotUpdatedAt={staffTomorrowSnapshot?.updatedAt}
      hasTodaySnapshot={Boolean(staffTodaySnapshot)}
      hasTomorrowSnapshot={Boolean(staffTomorrowSnapshot)}
      isOnline={isOnline}
      mutateToday={() => void mutateStaffToday()}
      mutateTomorrow={() => void mutateStaffTomorrow()}
    />
  )
}
