import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import { CalendarDays, ChevronLeft, Clock, Users } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { SakuraMark } from '@repo/ui/sakura-mark'
import type { AppointmentWithDetails } from '@repo/salon-core/types'
import { personInitials, staffAccentVar } from '#/lib/roster-visuals'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import { formatPersianFullDate } from '@repo/salon-core/jalali-display'
import { cn } from '@repo/ui/utils'

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Groups appointments into connected components of time-overlap, per date.
 * Returns a map from appointment id to the cluster it belongs to (including
 * itself). A cluster of size >= 2 means those appointments run concurrently.
 */
export function buildConcurrencyClusters(
  appointments: AppointmentWithDetails[],
): Map<string, AppointmentWithDetails[]> {
  const result = new Map<string, AppointmentWithDetails[]>()
  const byDate = new Map<string, AppointmentWithDetails[]>()
  for (const apt of appointments) {
    const list = byDate.get(apt.date)
    if (list) list.push(apt)
    else byDate.set(apt.date, [apt])
  }

  for (const list of byDate.values()) {
    const sorted = [...list].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    )
    let current: AppointmentWithDetails[] = []
    let clusterEnd = -1
    const flush = () => {
      if (current.length === 0) return
      const group = current
      for (const apt of group) result.set(apt.id, group)
      current = []
    }
    for (const apt of sorted) {
      const start = timeToMinutes(apt.startTime)
      const end = timeToMinutes(apt.endTime)
      if (current.length === 0 || start < clusterEnd) {
        current.push(apt)
        clusterEnd = Math.max(clusterEnd, end)
      } else {
        flush()
        current = [apt]
        clusterEnd = end
      }
    }
    flush()
  }

  return result
}

interface ConcurrentAppointmentsSheetProps {
  cluster: AppointmentWithDetails[] | null
  onOpenChange: (open: boolean) => void
  onSelectAppointment: (appointment: AppointmentWithDetails) => void
}

export function ConcurrentAppointmentsSheet({
  cluster,
  onOpenChange,
  onSelectAppointment,
}: ConcurrentAppointmentsSheetProps) {
  const sorted = useMemo(
    () =>
      cluster
        ? [...cluster].sort(
            (a, b) =>
              timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
              a.staff.name.localeCompare(b.staff.name, 'fa'),
          )
        : [],
    [cluster],
  )

  const winStart = useMemo(
    () =>
      sorted.length
        ? Math.min(...sorted.map((a) => timeToMinutes(a.startTime)))
        : 0,
    [sorted],
  )
  const winEnd = useMemo(
    () =>
      sorted.length
        ? Math.max(...sorted.map((a) => timeToMinutes(a.endTime)))
        : 0,
    [sorted],
  )
  const winDur = Math.max(1, winEnd - winStart)

  const lanes = useMemo(() => {
    const map = new Map<
      string,
      {
        staff: AppointmentWithDetails['staff']
        appts: AppointmentWithDetails[]
      }
    >()
    for (const apt of sorted) {
      const entry = map.get(apt.staffId)
      if (entry) entry.appts.push(apt)
      else map.set(apt.staffId, { staff: apt.staff, appts: [apt] })
    }
    return Array.from(map.values())
  }, [sorted])

  const ticks = useMemo(() => {
    if (!sorted.length) return [] as number[]
    const startHour = Math.floor(winStart / 60)
    const endHour = Math.ceil(winEnd / 60)
    const span = endHour - startHour
    const step = span > 3 ? 2 : 1
    const out: number[] = []
    for (let h = startHour; h <= endHour; h += step) out.push(h * 60)
    return out
  }, [sorted, winStart, winEnd])

  const open = sorted.length > 0
  const dateLabel = open ? formatPersianFullDate(parseISO(sorted[0].date)) : ''

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="pb-2">
          <div className="flex items-center justify-end gap-2 text-muted-foreground">
            <DrawerTitle className="text-[13px] font-semibold text-foreground">
              {dateLabel}
            </DrawerTitle>
            <CalendarDays className="size-4" />
          </div>
          <DrawerDescription className="sr-only">
            فهرست نوبت‌های همزمان در این بازه
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-4 pb-2">
          {/* Hero */}
          <div className="hero-surface relative overflow-hidden rounded-[22px] px-5 py-4">
            <SakuraMark
              size={150}
              color="rgba(255,255,255,.06)"
              style={{ position: 'absolute', top: -40, insetInlineStart: -30 }}
            />
            <SakuraMark
              size={96}
              color="rgba(255,255,255,.05)"
              style={{
                position: 'absolute',
                bottom: -40,
                insetInlineStart: 70,
                transform: 'rotate(30deg)',
              }}
            />
            <div className="relative flex items-center justify-between gap-3">
              <span className="text-[44px] font-extrabold leading-none tabular-nums">
                {toPersianDigits(sorted.length)}
              </span>
              <div className="text-end">
                <div className="text-[17px] font-bold">نوبت همزمان</div>
                <div className="mt-1.5 flex items-center justify-end gap-3 text-[12px] opacity-80">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {toPersianDigits(lanes.length)} پرسنل
                  </span>
                  <span className="flex items-center gap-1" dir="ltr">
                    {formatPersianTime(sorted[0]?.startTime ?? '')} –{' '}
                    {formatPersianTime(
                      sorted.reduce(
                        (latest, a) =>
                          a.endTime > latest ? a.endTime : latest,
                        sorted[0]?.endTime ?? '',
                      ),
                    )}
                    <Clock className="size-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-staff gantt */}
          <section>
            <div className="mb-2.5 flex items-center justify-end gap-1.5 text-[13px] font-bold text-foreground">
              چه کسی، چه زمانی؟
              <Users className="size-4 text-muted-foreground" />
            </div>
            <div className="rounded-[18px] border border-border/60 bg-muted/40 p-3">
              {/* time axis */}
              <div className="mb-2 flex">
                <div className="relative h-4 flex-1">
                  {ticks.map((t) => (
                    <span
                      key={t}
                      dir="ltr"
                      className="absolute top-0 -translate-x-1/2 text-[10.5px] font-medium text-muted-foreground tabular-nums"
                      style={{
                        insetInlineStart: `${((t - winStart) / winDur) * 100}%`,
                      }}
                    >
                      {formatPersianTime(
                        `${String(Math.floor(t / 60)).padStart(2, '0')}:00`,
                      )}
                    </span>
                  ))}
                </div>
                <div className="w-16" />
              </div>

              {/* lanes */}
              <div className="flex flex-col gap-1.5">
                {lanes.map((lane) => {
                  const color = staffAccentVar(lane.staff.color)
                  return (
                    <div
                      key={lane.staff.id}
                      className="flex items-center gap-2"
                    >
                      <div className="relative h-7 flex-1 rounded-lg bg-card/70">
                        {lane.appts.map((apt) => {
                          const start = timeToMinutes(apt.startTime)
                          const end = timeToMinutes(apt.endTime)
                          const isCancelled =
                            apt.status === 'cancelled' ||
                            apt.status === 'no-show'
                          return (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => onSelectAppointment(apt)}
                              title={`${apt.client.name} · ${apt.bookedServiceName}`}
                              className={cn(
                                'absolute inset-y-0.5 flex items-center justify-center overflow-hidden rounded-md px-1.5 text-[10px] font-bold text-white transition-opacity active:opacity-80',
                                isCancelled && 'opacity-60',
                              )}
                              style={{
                                insetInlineStart: `${((start - winStart) / winDur) * 100}%`,
                                width: `${((end - start) / winDur) * 100}%`,
                                minWidth: 24,
                                backgroundColor: isCancelled
                                  ? 'var(--destructive)'
                                  : color,
                              }}
                            >
                              <span className="truncate">
                                {apt.client.name.split(' ')[0]}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex w-16 shrink-0 items-center justify-end gap-1.5">
                        <span className="max-w-12 truncate text-[12px] font-semibold text-foreground">
                          {lane.staff.name.split(' ')[0]}
                        </span>
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Time-ordered list */}
          <section>
            <div className="mb-2.5 flex items-center justify-end gap-1.5 text-[13px] font-bold text-foreground">
              به ترتیب زمان
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <div className="overflow-hidden rounded-[18px] border border-border/60 bg-card">
              {sorted.map((apt, index) => {
                const color = staffAccentVar(apt.staff.color)
                const duration =
                  timeToMinutes(apt.endTime) - timeToMinutes(apt.startTime)
                const isCancelled =
                  apt.status === 'cancelled' || apt.status === 'no-show'
                return (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => onSelectAppointment(apt)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3.5 py-3 text-start transition-colors active:bg-muted/50',
                      index > 0 && 'border-t border-border/50',
                    )}
                  >
                    <div className="min-w-[44px] text-center tabular-nums">
                      <div
                        className="text-[13px] font-bold text-foreground"
                        dir="ltr"
                      >
                        {formatPersianTime(apt.startTime)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {toPersianDigits(duration)} د
                      </div>
                    </div>
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
                        color,
                      }}
                    >
                      {personInitials(apt.client.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'truncate text-[13px] font-semibold text-foreground',
                          isCancelled && 'line-through',
                        )}
                      >
                        {apt.client.name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {apt.bookedServiceName} · {apt.staff.name.split(' ')[0]}
                      </div>
                    </div>
                    <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              بستن
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
