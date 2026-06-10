import { use, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CalendarDays, Clock, Plus, Users } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Card } from '@repo/ui/card'
import { JalaliDatePicker } from '@repo/ui/jalali-date-picker'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { cn } from '@repo/ui/utils'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

import {
  buildManagerTodayViewModel,
  buildWeekStrip,
} from '#/lib/today-view-model'
import type { AppointmentDetailChange } from '#/lib/appointment-surface'
import {
  AppointmentFlowDrawers,
  useAppointmentFlow,
} from '#/components/appointments'
import { ManagerTodaySkeleton } from '#/components/today-skeleton'
import { ManagerTodayContext } from '#/components/today/manager-today-context'
import {
  AttentionCard,
  HeaderGreeting,
  HeroSep,
  HeroStat,
  QueueRow,
  SectionTitle,
  TeamRow,
} from '#/components/today/today-shared'

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

export function ManagerTodayScreen() {
  const ctx = use(ManagerTodayContext)
  if (!ctx) {
    throw new Error(
      'ManagerTodayScreen must be used within ManagerTodayProvider',
    )
  }

  const { state, actions } = ctx
  const {
    date,
    data,
    isLoading,
    error,
    staff,
    services,
    clients,
    managerName,
  } = state
  const { setDate, mutateToday, onRefreshResources } = actions

  const navigate = useNavigate()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const appointmentFlow = useAppointmentFlow({
    defaultDate: date,
    defaultTime: '09:00',
  })
  const createReady = staff.length > 0 && services.length > 0
  const createDisabled = !createReady

  const {
    queue,
    activeCount,
    attentionItems,
    teamRows,
    totalAppointments,
    doneCount,
    droppedCount,
    defaultCreateTime,
  } = useMemo(() => buildManagerTodayViewModel({ data, staff }), [data, staff])

  const handleRetry = () => {
    mutateToday()
    onRefreshResources()
  }

  const handleOpenCreateDrawer = () => {
    appointmentFlow.actions.openCreate(date, defaultCreateTime)
  }

  const handleAppointmentCreated = (appointment: AppointmentWithDetails) => {
    appointmentFlow.actions.closeCreateAfterSuccess()
    if (appointment.date !== date) {
      navigate({ to: '/calendar', search: { date: appointment.date } })
      return
    }
    mutateToday()
  }

  const handleDetailChange = (_change: AppointmentDetailChange) => {
    appointmentFlow.actions.closeDetail()
    mutateToday()
  }

  const appointmentFlowDrawers = (
    <AppointmentFlowDrawers
      flow={appointmentFlow}
      staff={staff}
      services={services}
      clients={clients}
      availabilityInitialDate={date}
      onAppointmentCreated={handleAppointmentCreated}
      onDetailChange={handleDetailChange}
      onClientsChanged={onRefreshResources}
    />
  )

  const headerProps = {
    name: managerName,
    count: totalAppointments,
    date,
    setDate,
    onCreate: handleOpenCreateDrawer,
    createDisabled,
    showDatePicker,
    onToggleDatePicker: () => setShowDatePicker((value) => !value),
  }

  if (!data && isLoading) {
    return <ManagerTodaySkeleton />
  }

  if (!data && !isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ManagerTodayHeader {...headerProps} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            نمای امروز بارگذاری نشد
          </p>
          {error instanceof Error ? (
            <p className="text-xs text-destructive">{error.message}</p>
          ) : null}
          <Button size="sm" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
        {appointmentFlowDrawers}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ManagerTodayHeader {...headerProps} />

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
                    onOpen={() =>
                      appointmentFlow.actions.openDetail(appointment)
                    }
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
                  disabled={!createReady}
                  onClick={() =>
                    appointmentFlow.actions.setAvailabilityOpen(true)
                  }
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

      {appointmentFlowDrawers}
    </div>
  )
}
