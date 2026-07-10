import { use, useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Clock } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Spinner } from '@repo/ui/spinner'
import { Skeleton } from '@repo/ui/skeleton'
import { cn } from '@repo/ui/utils'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { formatPersianTime } from '@repo/salon-core/persian-digits'
import { salonCurrentHm } from '@repo/salon-core/salon-local-time'
import type { AppointmentWithDetails } from '@repo/salon-core/types'

import { useStaffTodayStatusMutation } from '#/lib/use-staff-today-status-mutation'
import {
  ACTIVE_STATUSES,
  bookedServiceWithAddonCount,
  buildStaffTodayViewModel,
  summarizeNextOpenSlot,
} from '#/lib/today-view-model'
import { StatusPill } from '#/components/status-pill'
import { StaffTodaySkeleton } from '#/components/today-skeleton'
import { StaffTodayContext } from '#/components/today/staff-today-context'
import type { StatusActionFeedback } from '#/components/today/staff-today-context'
import { HeaderGreeting } from '#/components/today/today-shared'
import { StaffSalonSwitcher } from '#/components/staff/staff-salon-switcher'

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
  onPatchStatus,
}: {
  appointment: AppointmentWithDetails
  feedback: StatusActionFeedback
  onPatchStatus: (
    appointmentId: string,
    status: AppointmentWithDetails['status'],
  ) => void
}) {
  const currentFeedback =
    feedback?.appointmentId === appointment.id ? feedback : null
  const isSaving = currentFeedback?.mode === 'saving'
  const canActOnVisit = ACTIVE_STATUSES.has(appointment.status)

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
            disabled={isSaving}
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
          disabled={isSaving}
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
          disabled={isSaving}
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
          : 'border-mint/40 bg-mint-soft text-mint-fg',
      )}
    >
      {feedback.message}
    </p>
  )
}

export function StaffTodayScreen() {
  const ctx = use(StaffTodayContext)
  if (!ctx) {
    throw new Error('StaffTodayScreen must be used within StaffTodayProvider')
  }

  const { state, actions } = ctx
  const {
    todayDate,
    tomorrowDate,
    todayData,
    tomorrowData,
    todayLoading,
    tomorrowLoading,
    todayError,
    staffName,
  } = state
  const { mutateToday, mutateTomorrow } = actions

  const [clockHm, setClockHm] = useState(() => salonCurrentHm())
  const { statusFeedback, patchStatus } =
    useStaffTodayStatusMutation(mutateToday)

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

  const staffHeader = (
    <header className="border-b border-line-soft bg-card px-5 pt-3.5 pb-4">
      <div className="mb-2">
        <StaffSalonSwitcher compact />
      </div>
      <div className="flex items-start justify-between gap-3">
        <HeaderGreeting
          name={staffName}
          count={todayData ? todayAppointments.length : 0}
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
          <Link to="/calendar" search={{ date: todayDate }} aria-label="تقویم">
            <CalendarDays className="size-5" />
          </Link>
        </Button>
      </div>
    </header>
  )

  if (!todayData && todayLoading) {
    return <StaffTodaySkeleton />
  }

  if (!todayData && !todayLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        {staffHeader}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            برنامه امروز بارگذاری نشد
          </p>
          {todayError instanceof Error ? (
            <p className="text-xs text-destructive">{todayError.message}</p>
          ) : null}
          <Button size="sm" onClick={handleRetry}>
            تلاش دوباره
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {staffHeader}

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
                      onPatchStatus={patchStatus}
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
