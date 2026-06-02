import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Plus,
  Sun,
  Users,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { Skeleton } from '@repo/ui/skeleton'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { cn } from '@repo/ui/utils'
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  addDaysYmd,
  salonCurrentHm,
  salonTodayYmd,
} from '@repo/salon-core/salon-local-time'
import type {
  AppointmentWithDetails,
  Client,
  Service,
  TodayData,
  User,
} from '@repo/salon-core/types'

import { api } from '#/lib/api-client'
import { useAuth } from '#/lib/auth'
import { useNetworkStatus } from '#/lib/network-status'
import {
  ACTIVE_STATUSES,
  bookedServiceWithAddonCount,
  buildManagerTodayViewModel,
  buildStaffTodayViewModel,
  buildWeekStrip,
  DAY_WORK_MINUTES,
  firstNameOf,
  getInitials,
  greetingFa,
  staffCssVar,
  summarizeNextOpenSlot,
  type GroupedAttentionItem,
} from '#/lib/today-view-model'
import { useOfflineSnapshot } from '#/lib/offline-snapshot'
import {
  useBumpOfflineData,
  useManagerDataClient,
} from '#/lib/manager-data-client'
import { useManagerTodayIndexedDbSources } from '#/lib/use-manager-today-indexeddb'
import { AppointmentDrawer } from '#/components/calendar/appointment-drawer'
import { AppointmentDetailDrawer } from '#/components/calendar/appointment-detail-drawer'
import type { AppointmentDetailChange } from '#/components/calendar/appointment-detail-drawer'
import { AvailabilityDrawer } from '#/components/calendar/availability-drawer'
import { StatusPill } from '#/components/status-pill'
import {
  NetworkStatusBanner,
  OfflineStateCard,
} from '#/components/offline-state'
import {
  ManagerTodaySkeleton,
  StaffTodaySkeleton,
} from '#/components/today-skeleton'

export const Route = createFileRoute('/_authed/today')({
  component: TodayPage,
})

type StatusActionFeedback = {
  appointmentId: string
  status: AppointmentWithDetails['status']
  mode: 'saving' | 'saved' | 'queued' | 'error'
  message: string
} | null

function HeaderGreeting({
  name,
  count,
  dateLabel,
  suffix,
}: {
  name: string
  count: number
  dateLabel: string
  suffix?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sun className="size-3.5 text-amber" strokeWidth={1.8} />
        <span className="truncate">
          {greetingFa()}، {name}
        </span>
      </div>
      <div className="mt-1 truncate text-[22px] font-extrabold tracking-tight text-foreground">
        {toPersianDigits(count)} نوبت امروز
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {dateLabel}
        {suffix}
      </div>
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  count,
  action,
  children,
}: {
  icon: React.ElementType
  count?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-4 shrink-0 text-primary" />
        <h2 className="text-[15px] font-bold text-foreground">{children}</h2>
        {count ? (
          <span className="text-[11px] text-muted-foreground">{count}</span>
        ) : null}
      </div>
      {action}
    </div>
  )
}

function HeroStat({
  label,
  value,
  fg,
}: {
  label: string
  value: string
  fg?: string
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-medium opacity-70">{label}</div>
      <div
        className="mt-0.5 text-[17px] font-bold tabular-nums"
        style={fg ? { color: fg } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function HeroSep() {
  return <div className="w-px self-stretch bg-white/15" />
}

function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string
  color?: string | null
  size?: number
}) {
  const cssVar = staffCssVar(color)
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: `color-mix(in oklch, ${cssVar} 20%, transparent)`,
        color: cssVar,
      }}
    >
      {getInitials(name)}
    </div>
  )
}

function AttentionCard({ item }: { item: GroupedAttentionItem }) {
  const body = (
    <div
      className="flex h-full min-w-[220px] max-w-[240px] flex-col gap-1.5 rounded-[18px] border border-line-soft bg-card p-3.5 shadow-sm"
      style={{
        borderInlineStartWidth: 3,
        borderInlineStartColor: 'var(--amber)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-foreground">{item.title}</div>
        {item.labels[0] ? (
          <Badge variant="amber">{item.labels[0]}</Badge>
        ) : null}
      </div>
      <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {item.detail}
      </div>
      {item.labels.length > 1 ? (
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {item.labels.slice(1).map((label) => (
            <Badge key={label} variant="neutral">
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (item.clientId) {
    return (
      <Link
        to="/clients/$id"
        params={{ id: item.clientId }}
        className="shrink-0 active:opacity-80"
      >
        {body}
      </Link>
    )
  }
  return <div className="shrink-0">{body}</div>
}

function QueueRow({
  appointment,
  isFirst,
  onOpen,
}: {
  appointment: AppointmentWithDetails
  isFirst: boolean
  onOpen: () => void
}) {
  const isDone = appointment.status === 'completed'
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full touch-manipulation items-center gap-3 px-4 py-3.5 text-start transition-colors active:bg-accent/40',
        !isFirst && 'border-t border-line-soft',
        isDone && 'opacity-55',
      )}
    >
      <div className="min-w-[48px] text-center">
        <div
          className="text-sm font-bold tabular-nums text-foreground"
          dir="ltr"
        >
          {formatPersianTime(appointment.startTime)}
        </div>
        <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
          {toPersianDigits(
            durationMinutesFromRange(
              appointment.startTime,
              appointment.endTime,
            ),
          )}{' '}
          د
        </div>
      </div>
      <div className="h-9 w-px bg-line-soft" />
      <Avatar
        name={appointment.staff.name}
        color={appointment.staff.color}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            {appointment.client.name}
          </span>
          {isDone ? (
            <Check className="size-3.5 shrink-0 text-mint" strokeWidth={2.4} />
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {bookedServiceWithAddonCount(appointment)} ·{' '}
          {firstNameOf(appointment.staff.name)}
        </div>
      </div>
      <StatusPill status={appointment.status} />
    </button>
  )
}

function TeamRow({
  staffName,
  color,
  appointmentCount,
  bookedMinutes,
  isFirst,
}: {
  staffName: string
  color?: string | null
  appointmentCount: number
  bookedMinutes: number
  isFirst: boolean
}) {
  const pct = Math.min(
    100,
    Math.round((bookedMinutes / DAY_WORK_MINUTES) * 100),
  )
  const cssVar = staffCssVar(color)
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2',
        !isFirst && 'border-t border-line-soft',
      )}
    >
      <Avatar name={staffName} color={color} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {staffName}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {toPersianDigits(pct)}٪
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-deep">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: cssVar }}
          />
        </div>
        <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
          {toPersianDigits(appointmentCount)} نوبت ·{' '}
          {toPersianDigits(bookedMinutes)} دقیقه
        </div>
      </div>
    </div>
  )
}

function ManagerTodayHeader({
  name,
  count,
  date,
  setDate,
  onCreate,
  createDisabled,
  showDatePicker,
  onToggleDatePicker,
}: {
  name: string
  count: number
  date: string
  setDate: (date: string) => void
  onCreate: () => void
  createDisabled: boolean
  showDatePicker: boolean
  onToggleDatePicker: () => void
}) {
  const days = useMemo(() => buildWeekStrip(date), [date])
  const today = useMemo(() => salonTodayYmd(), [])

  return (
    <header className="border-b border-line-soft bg-card px-5 pt-3.5">
      <div className="flex items-start justify-between gap-3">
        <HeaderGreeting
          name={name}
          count={count}
          dateLabel={formatJalaliFullDate(date)}
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={createDisabled}
          aria-label="نوبت جدید"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_14px_-6px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-opacity disabled:opacity-50"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto py-3.5 scrollbar-hide">
        {days.map((day) => {
          const isActive = day.ymd === date
          const isToday = day.ymd === today
          return (
            <button
              key={day.ymd}
              type="button"
              onClick={() => setDate(day.ymd)}
              className={cn(
                'flex h-[60px] flex-[1_0_44px] flex-col items-center justify-center gap-1 rounded-2xl border transition-colors',
                isActive
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-line-soft text-foreground active:bg-accent/40',
                !isActive && isToday && 'text-primary',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {day.weekday}
              </span>
              <span className="text-base font-bold tabular-nums">
                {day.dayNum}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onToggleDatePicker}
          aria-label="انتخاب تاریخ"
          className={cn(
            'flex h-[60px] w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors',
            showDatePicker
              ? 'border-transparent bg-blush-soft text-primary'
              : 'border-line-soft text-muted-foreground active:bg-accent/40',
          )}
        >
          <CalendarDays className="size-4" />
        </button>
      </div>

      {showDatePicker ? (
        <div className="pb-3.5">
          <JalaliDatePicker value={date} onChange={setDate} />
        </div>
      ) : null}
    </header>
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
  managerName,
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
  managerName: string
}) {
  const navigate = useNavigate()
  const dataClient = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [showAvailabilityDrawer, setShowAvailabilityDrawer] = useState(false)
  const [detailAppointment, setDetailAppointment] =
    useState<AppointmentWithDetails | null>(null)
  const [createDate, setCreateDate] = useState(date)
  const [createTime, setCreateTime] = useState('09:00')
  const [initialStaffIdForCreate, setInitialStaffIdForCreate] = useState<
    string | undefined
  >(undefined)
  const [initialServiceIdForCreate, setInitialServiceIdForCreate] = useState<
    string | undefined
  >(undefined)
  const createReady = staff.length > 0 && services.length > 0
  const availabilityReady = createReady && isOnline
  const createDisabled = (!isOnline && !dataClient) || !createReady

  const {
    queue,
    activeCount,
    attentionItems,
    teamRows,
    totalAppointments,
    doneCount,
    droppedCount,
    defaultCreateTime,
  } = useMemo(
    () => buildManagerTodayViewModel({ data, staff }),
    [data, staff],
  )

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
      navigate({ to: '/calendar', search: { date: appointment.date } })
      return
    }
    mutateToday()
  }

  const handleDetailChange = (_change: AppointmentDetailChange) => {
    setDetailAppointment(null)
    bumpOfflineData()
    mutateToday()
  }

  if (!data && isLoading) {
    return <ManagerTodaySkeleton />
  }

  if (!data && !isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ManagerTodayHeader
          name={managerName}
          count={totalAppointments}
          date={date}
          setDate={setDate}
          onCreate={handleOpenCreateDrawer}
          createDisabled={createDisabled}
          showDatePicker={showDatePicker}
          onToggleDatePicker={() => setShowDatePicker((value) => !value)}
        />

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
      <ManagerTodayHeader
        name={managerName}
        count={totalAppointments}
        date={date}
        setDate={setDate}
        onCreate={handleOpenCreateDrawer}
        createDisabled={createDisabled}
        showDatePicker={showDatePicker}
        onToggleDatePicker={() => setShowDatePicker((value) => !value)}
      />

      <NetworkStatusBanner
        routeLabel="نمای امروز"
        isOnline={isOnline}
        hasSnapshot={hasSnapshot}
        snapshotUpdatedAt={snapshotUpdatedAt}
        hasError={Boolean(error)}
        onRetry={handleRetry}
      />

      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="flex flex-col gap-5">
          <div className="hero-surface relative overflow-hidden rounded-[24px] px-5 py-5">
            <SakuraMark
              size={170}
              color="rgba(255,255,255,.06)"
              style={{ position: 'absolute', top: -30, insetInlineStart: -30 }}
            />
            <SakuraMark
              size={120}
              color="rgba(255,255,255,.05)"
              style={{
                position: 'absolute',
                bottom: -50,
                insetInlineStart: 80,
                transform: 'rotate(30deg)',
              }}
            />
            <div className="relative">
              <div className="text-[11px] font-medium opacity-70">
                نوبت‌های امروز
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[32px] font-extrabold tracking-tight tabular-nums">
                  {toPersianDigits(totalAppointments)}
                </span>
                <span className="text-[13px] opacity-85">نوبت</span>
              </div>
              <div className="mt-4 flex gap-3.5 border-t border-white/15 pt-3.5">
                <HeroStat
                  label="انجام شده"
                  value={toPersianDigits(doneCount)}
                  fg="#A8D9B8"
                />
                <HeroSep />
                <HeroStat
                  label="در صف"
                  value={toPersianDigits(activeCount)}
                  fg="#F4E0A8"
                />
                <HeroSep />
                <HeroStat
                  label="لغو / غیبت"
                  value={toPersianDigits(droppedCount)}
                />
              </div>
            </div>
          </div>

          {attentionItems.length > 0 ? (
            <section>
              <SectionTitle
                icon={AlertTriangle}
                count={`${toPersianDigits(attentionItems.length)} مورد`}
              >
                نیاز به توجه
              </SectionTitle>
              <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1.5 scrollbar-hide">
                {attentionItems.map((item) => (
                  <AttentionCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle
              icon={Clock}
              action={
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  asChild
                >
                  <Link to="/calendar" search={{ date }}>
                    همه
                  </Link>
                </Button>
              }
            >
              صف امروز
            </SectionTitle>
            <Card className="gap-0 overflow-hidden py-0">
              {queue.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <SakuraMark size={56} color="var(--blush-soft)" />
                  <p className="text-sm text-muted-foreground">
                    نوبتی برای این روز ثبت نشده است.
                  </p>
                  <Button
                    size="sm"
                    className="mt-1 touch-manipulation gap-1"
                    disabled={createDisabled}
                    onClick={handleOpenCreateDrawer}
                  >
                    <Plus className="size-4" />
                    افزودن نوبت
                  </Button>
                </div>
              ) : (
                queue.map((appointment, index) => (
                  <QueueRow
                    key={appointment.id}
                    appointment={appointment}
                    isFirst={index === 0}
                    onOpen={() => setDetailAppointment(appointment)}
                  />
                ))
              )}
            </Card>
          </section>

          <section>
            <SectionTitle
              icon={Users}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary"
                  disabled={!availabilityReady}
                  onClick={() => setShowAvailabilityDrawer(true)}
                >
                  بررسی زمان خالی
                </Button>
              }
            >
              تیم امروز
            </SectionTitle>
            <Card className="px-4 py-3.5">
              {teamRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  اطلاعاتی برای نمایش وجود ندارد.
                </p>
              ) : (
                teamRows.map((row, index) => (
                  <TeamRow
                    key={row.staffId}
                    staffName={row.staffName}
                    color={row.color}
                    appointmentCount={row.appointmentCount}
                    bookedMinutes={row.bookedMinutes}
                    isFirst={index === 0}
                  />
                ))
              )}
            </Card>
          </section>
        </div>
      </div>

      <AppointmentDetailDrawer
        appointment={detailAppointment}
        onOpenChange={(open) => {
          if (!open) setDetailAppointment(null)
        }}
        staff={staff}
        services={services}
        clients={clients}
        onSuccess={handleDetailChange}
        onClientsChanged={onRefreshResources}
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
        onClientsChanged={onRefreshResources}
      />
    </div>
  )
}

function StaffAppointmentCard({
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
        'space-y-3 rounded-2xl border border-line-soft bg-card p-3 shadow-sm',
        tone === 'highlight' && 'border-primary/30 bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {appointment.client.name}
            </p>
            {appointment.client.isPlaceholder ? (
              <Badge variant="amber" className="shrink-0">
                اطلاعات ناقص
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {bookedServiceWithAddonCount(appointment)}
          </p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {formatPersianTime(appointment.startTime)} -{' '}
            {formatPersianTime(appointment.endTime)} · {meta}
          </p>
          {appointment.notes ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {appointment.notes}
            </p>
          ) : null}
        </div>
        <StatusPill status={appointment.status} className="shrink-0" />
      </div>
      {children}
    </div>
  )
}

function StaffActionButtons({
  appointment,
  feedback,
  isOnline,
  onPatchStatus,
}: {
  appointment: AppointmentWithDetails
  feedback: StatusActionFeedback
  isOnline: boolean
  onPatchStatus: (
    appointmentId: string,
    status: AppointmentWithDetails['status'],
  ) => void
}) {
  const currentFeedback =
    feedback?.appointmentId === appointment.id ? feedback : null
  const isSaving = currentFeedback?.mode === 'saving'
  const canActOnVisit = ACTIVE_STATUSES.has(appointment.status)
  const networkBlocked = !isOnline

  if (!canActOnVisit) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {appointment.status === 'scheduled' ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 touch-manipulation text-xs"
            disabled={isSaving || networkBlocked}
            onClick={() => onPatchStatus(appointment.id, 'confirmed')}
          >
            {isSaving && currentFeedback.status === 'confirmed' && (
              <Spinner className="ml-1.5 size-3" />
            )}
            تایید
          </Button>
        ) : null}
        <Button
          size="sm"
          className="h-8 touch-manipulation text-xs"
          disabled={isSaving || networkBlocked}
          onClick={() => onPatchStatus(appointment.id, 'completed')}
        >
          {isSaving && currentFeedback.status === 'completed' && (
            <Spinner className="ml-1.5 size-3" />
          )}
          انجام شد
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 touch-manipulation text-xs"
          disabled={isSaving || networkBlocked}
          onClick={() => onPatchStatus(appointment.id, 'no-show')}
        >
          {isSaving && currentFeedback.status === 'no-show' && (
            <Spinner className="ml-1.5 size-3" />
          )}
          غیبت
        </Button>
      </div>
      {currentFeedback && currentFeedback.mode !== 'saving' && (
        <p
          className={cn(
            'rounded-xl border px-2.5 py-1.5 text-xs',
            currentFeedback.mode === 'error'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : currentFeedback.mode === 'queued'
                ? 'border-amber/40 bg-amber-soft text-amber-fg'
                : 'border-mint/40 bg-mint-soft text-mint-fg',
          )}
        >
          {currentFeedback.message}
        </p>
      )}
    </div>
  )
}

function StatusFeedbackBanner({
  feedback,
}: {
  feedback: StatusActionFeedback
}) {
  if (!feedback || feedback.mode === 'saving') return null

  return (
    <p
      className={cn(
        'rounded-2xl border px-3 py-2 text-xs shadow-sm',
        feedback.mode === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : feedback.mode === 'queued'
            ? 'border-amber/40 bg-amber-soft text-amber-fg'
            : 'border-mint/40 bg-mint-soft text-mint-fg',
      )}
    >
      {feedback.message}
    </p>
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
  staffName,
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
  staffName: string
}) {
  const [statusFeedback, setStatusFeedback] =
    useState<StatusActionFeedback>(null)
  const [clockHm, setClockHm] = useState(() => salonCurrentHm())

  const updateAppointmentStatus = useMutation({
    mutationFn: ({
      appointmentId,
      status,
    }: {
      appointmentId: string
      status: AppointmentWithDetails['status']
    }) => api.appointments.updateStatus(appointmentId, status),
    meta: { skipSuccessToast: true, skipErrorToast: true },
  })

  useEffect(() => {
    const timer = window.setInterval(() => setClockHm(salonCurrentHm()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const {
    todayAppointments,
    tomorrowAppointments,
    currentAppointment,
    nextAppointment,
    nextOpenSlot,
    checkingTomorrowOpenSlots,
  } = useMemo(
    () =>
      buildStaffTodayViewModel({
        todayData,
        tomorrowData,
        clockHm,
        tomorrowLoading,
      }),
    [todayData, tomorrowData, clockHm, tomorrowLoading],
  )

  const handleRetry = () => {
    mutateToday()
    mutateTomorrow()
  }

  const handlePatchStatus = async (
    appointmentId: string,
    status: AppointmentWithDetails['status'],
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
      const payload = await updateAppointmentStatus.mutateAsync({
        appointmentId,
        status,
      })
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'saved',
        message:
          'removedAppointmentId' in payload && payload.removedAppointmentId
            ? 'رزرو موقت لغو و حذف شد.'
            : 'وضعیت ثبت شد.',
      })
      mutateToday()
    } catch (err) {
      setStatusFeedback({
        appointmentId,
        status,
        mode: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'خطایی رخ داد. دوباره تلاش کنید.',
      })
    }
  }

  if (!todayData && todayLoading) {
    return <StaffTodaySkeleton />
  }

  if (!todayData && !todayLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="border-b border-line-soft bg-card px-5 pt-3.5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <HeaderGreeting
              name={staffName}
              count={0}
              dateLabel={formatJalaliFullDate(todayDate)}
              suffix={` · اکنون ${formatPersianTime(clockHm)}`}
            />
            <Button
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-2xl"
              asChild
            >
              <Link
                to="/calendar"
                search={{ date: todayDate }}
                aria-label="تقویم"
              >
                <CalendarDays className="size-5" />
              </Link>
            </Button>
          </div>
        </header>

        <NetworkStatusBanner
          routeLabel="برنامه من"
          isOnline={isOnline}
          hasSnapshot={hasTodaySnapshot || hasTomorrowSnapshot}
          snapshotUpdatedAt={
            todaySnapshotUpdatedAt ?? tomorrowSnapshotUpdatedAt
          }
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
      <header className="border-b border-line-soft bg-card px-5 pt-3.5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <HeaderGreeting
            name={staffName}
            count={todayAppointments.length}
            dateLabel={
              todayData
                ? formatJalaliFullDate(todayData.date)
                : formatJalaliFullDate(todayDate)
            }
            suffix={` · اکنون ${formatPersianTime(clockHm)}`}
          />
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 rounded-2xl"
            asChild
          >
            <Link
              to="/calendar"
              search={{ date: todayDate }}
              aria-label="تقویم"
            >
              <CalendarDays className="size-5" />
            </Link>
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

          <Card className="border-line-soft shadow-sm">
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
                    <Badge variant="plum">در حال انجام</Badge>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {formatPersianTime(currentAppointment.startTime)} -{' '}
                      {formatPersianTime(currentAppointment.endTime)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">
                    {currentAppointment.client.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bookedServiceWithAddonCount(currentAppointment)}
                  </p>
                </div>
              ) : nextAppointment ? (
                <div className="space-y-2 rounded-2xl border border-line-soft p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral">بعدی</Badge>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {formatPersianTime(nextAppointment.startTime)} -{' '}
                      {formatPersianTime(nextAppointment.endTime)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold">
                    {nextAppointment.client.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bookedServiceWithAddonCount(nextAppointment)}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line-soft p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    برای ادامه امروز نوبت فعالی باقی نمانده است.
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-muted/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">بازه آزاد بعدی</p>
                  {nextOpenSlot ? (
                    <Badge variant="sky">{nextOpenSlot.dayLabel}</Badge>
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

          <Card className="border-line-soft shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">نوبت‌های امروز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  برای امروز نوبتی ثبت نشده است.
                </p>
              ) : (
                todayAppointments.map((appointment) => (
                  <StaffAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    meta={
                      appointment.status === 'completed'
                        ? 'انجام شده'
                        : 'مشتری امروز'
                    }
                    tone={
                      currentAppointment?.id === appointment.id
                        ? 'highlight'
                        : 'default'
                    }
                  >
                    <StaffActionButtons
                      appointment={appointment}
                      feedback={statusFeedback}
                      isOnline={isOnline}
                      onPatchStatus={handlePatchStatus}
                    />
                  </StaffAppointmentCard>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-line-soft shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm">نگاه به فردا</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 touch-manipulation text-xs"
                asChild
              >
                <Link to="/calendar" search={{ date: tomorrowDate }}>
                  باز کردن در تقویم
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!tomorrowData && tomorrowLoading ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-line-soft p-3 shadow-sm">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line-soft p-3 shadow-sm">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                </div>
              ) : tomorrowAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  برای فردا هنوز نوبتی ثبت نشده است.
                </p>
              ) : (
                tomorrowAppointments.map((appointment) => (
                  <StaffAppointmentCard
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

type StaffResponse = { staff: User[] }
type ServicesResponse = { services: Service[] }
type ClientsResponse = { clients: Client[] }

function TodayPage() {
  const { user } = useAuth()
  const isOnline = useNetworkStatus()
  const initialToday = useMemo(() => salonTodayYmd(), [])
  const [managerDate, setManagerDate] = useState(initialToday)

  const isManager = user?.role === 'manager'
  const isStaff = user?.role === 'staff'

  const managerTodayQuery = useQuery<TodayData>({
    queryKey: ['today', managerDate],
    queryFn: ({ signal }) => api.today.get(managerDate, { signal }),
    enabled: Boolean(isManager),
  })

  const staffQuery = useQuery<StaffResponse>({
    queryKey: ['staff', 'list'],
    queryFn: ({ signal }) => api.staff.list({ signal }),
    enabled: Boolean(isManager),
  })
  const servicesQuery = useQuery<ServicesResponse>({
    queryKey: ['services', 'list'],
    queryFn: ({ signal }) => api.services.list({ signal }),
    enabled: Boolean(isManager),
  })
  const clientsQuery = useQuery<ClientsResponse>({
    queryKey: ['clients'],
    queryFn: ({ signal }) => api.clients.list({ signal }),
    enabled: Boolean(isManager),
  })

  const staffTodayDate = initialToday
  const staffTomorrowDate = useMemo(
    () => addDaysYmd(initialToday, 1),
    [initialToday],
  )

  const staffTodayQuery = useQuery<TodayData>({
    queryKey: ['today', 'staff', staffTodayDate],
    queryFn: ({ signal }) => api.today.get(staffTodayDate, { signal }),
    enabled: Boolean(isStaff),
  })
  const staffTomorrowQuery = useQuery<TodayData>({
    queryKey: ['today', 'staff', staffTomorrowDate],
    queryFn: ({ signal }) => api.today.get(staffTomorrowDate, { signal }),
    enabled: Boolean(isStaff),
  })

  const staffTodaySnapshot = useOfflineSnapshot(
    isStaff ? `today:staff:${staffTodayDate}` : null,
    staffTodayQuery.data,
  )
  const staffTomorrowSnapshot = useOfflineSnapshot(
    isStaff ? `today:staff:${staffTomorrowDate}` : null,
    staffTomorrowQuery.data,
  )

  const managerIdb = useManagerTodayIndexedDbSources(
    Boolean(isManager),
    isOnline,
    managerDate,
    managerTodayQuery.data,
    staffQuery.data?.staff,
    servicesQuery.data?.services,
    clientsQuery.data?.clients,
  )

  if (!user) {
    return null
  }

  if (user.role === 'manager') {
    const managerDisplayData = managerIdb.todayData ?? managerTodayQuery.data
    return (
      <ManagerTodayView
        date={managerDate}
        setDate={setManagerDate}
        data={managerDisplayData}
        isLoading={
          (managerTodayQuery.isLoading || managerIdb.idbLoading) &&
          !managerDisplayData
        }
        error={managerTodayQuery.error}
        snapshotUpdatedAt={managerIdb.snapshotUpdatedAt}
        hasSnapshot={managerIdb.hasSnapshot}
        isOnline={isOnline}
        mutateToday={() => void managerTodayQuery.refetch()}
        staff={managerIdb.staff}
        services={managerIdb.services}
        clients={managerIdb.clients}
        managerName={firstNameOf(user.name)}
        onRefreshResources={() => {
          void staffQuery.refetch()
          void servicesQuery.refetch()
          void clientsQuery.refetch()
        }}
      />
    )
  }

  return (
    <StaffTodayView
      todayDate={staffTodayDate}
      tomorrowDate={staffTomorrowDate}
      todayData={staffTodayQuery.data ?? staffTodaySnapshot?.data}
      tomorrowData={staffTomorrowQuery.data ?? staffTomorrowSnapshot?.data}
      todayLoading={staffTodayQuery.isLoading}
      tomorrowLoading={staffTomorrowQuery.isLoading}
      todayError={staffTodayQuery.error}
      tomorrowError={staffTomorrowQuery.error}
      todaySnapshotUpdatedAt={staffTodaySnapshot?.updatedAt}
      tomorrowSnapshotUpdatedAt={staffTomorrowSnapshot?.updatedAt}
      hasTodaySnapshot={Boolean(staffTodaySnapshot)}
      hasTomorrowSnapshot={Boolean(staffTomorrowSnapshot)}
      isOnline={isOnline}
      mutateToday={() => void staffTodayQuery.refetch()}
      mutateTomorrow={() => void staffTomorrowQuery.refetch()}
      staffName={firstNameOf(user.name)}
    />
  )
}
