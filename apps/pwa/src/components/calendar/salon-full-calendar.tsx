import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import type {
  DateSelectArg,
  DatesSetArg,
  DateRangeInput,
  EventClickArg,
  EventInput,
} from '@fullcalendar/core'
import faLocale from '@fullcalendar/core/locales/fa'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { addDays, addMonths, format, subDays } from 'date-fns'
import { WORKING_HOURS } from '@repo/salon-core/types'
import type {
  AppointmentWithDetails,
  BusinessHours,
  CalendarView,
} from '@repo/salon-core/types'
import {
  expandedZonedToDate,
  formatPersianDayHeaderCompact,
  formatPersianDayNumber,
  formatPersianListDayRelative,
  formatPersianTimeHm,
} from '@repo/salon-core/jalali-display'
import { cn } from '@repo/ui/utils'
import { formatCompactServiceLabel } from '#/components/services/service-catalog-groups'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  salonCurrentHm,
  salonTodayYmd,
} from '@repo/salon-core/salon-local-time'
import { buildConcurrencyClusters } from '#/components/calendar/concurrent-appointments-sheet'
import { personInitials, staffAccentVar } from '#/lib/roster-visuals'

function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fcDayCellToDate(cell: { date: unknown }): Date {
  const d = cell.date
  if (d instanceof Date && !Number.isNaN(d.getTime())) return d
  if (Array.isArray(d) && d.length >= 3) {
    return new Date(
      d[0] as number,
      (d[1] as number) - 1,
      d[2] as number,
      12,
      0,
      0,
      0,
    )
  }
  return new Date(d as number)
}

function calendarViewToFc(view: CalendarView): string {
  switch (view) {
    case 'day':
      return 'timeGridDay'
    case 'week':
      return 'timeGridWeek'
    case 'month':
      return 'dayGridMonth'
    case 'list':
      return 'listUpcomingMonth'
    default:
      return 'timeGridWeek'
  }
}

function minutesToSlotDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function appointmentServiceLabel(
  apt: AppointmentWithDetails,
  view: CalendarView,
) {
  const base =
    view === 'week'
      ? apt.bookedServiceName
      : formatCompactServiceLabel(apt.service)
  if (view === 'week' || apt.bookedAddonCount <= 0) return base
  return `${base} +${toPersianDigits(apt.bookedAddonCount)}`
}

function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.max(0, h * 60 + m - minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(24 * 60, h * 60 + m + minutes)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}

function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function isSmallViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 640px)').matches
  )
}

export interface SalonFullCalendarProps {
  className?: string
  appointments: AppointmentWithDetails[]
  view: CalendarView
  currentDate: Date
  onVisibleRangeChange: (
    start: string,
    endInclusive: string,
    activeStart: Date,
  ) => void
  onSlotSelect: (dateStr: string, timeStr: string) => void
  onDaySummaryOpen?: (dateStr: string) => void
  onEventClick: (appointment: AppointmentWithDetails) => void
  /** Week view: tapping a collapsed "N همزمان" pill resolves to the overlapping cluster. */
  onClusterClick?: (cluster: AppointmentWithDetails[]) => void
  /** From DB / API; falls back to WORKING_HOURS if omitted */
  businessHours?: BusinessHours
  /** Staff: view-only calendar (no slot selection). */
  readOnly?: boolean
  /** Non-blocking refresh state for range navigation and background revalidation. */
  isRefreshing?: boolean
}

export const SalonFullCalendar = memo(function SalonFullCalendar({
  className,
  appointments,
  view,
  currentDate,
  onVisibleRangeChange,
  onSlotSelect,
  onDaySummaryOpen,
  onEventClick,
  onClusterClick,
  businessHours: businessHoursProp,
  readOnly = false,
  isRefreshing = false,
}: SalonFullCalendarProps) {
  const calendarRef = useRef<InstanceType<typeof FullCalendar>>(null)
  const bh = businessHoursProp ?? {
    workingStart: WORKING_HOURS.start,
    workingEnd: WORKING_HOURS.end,
    slotDurationMinutes: WORKING_HOURS.slotDuration,
  }
  const [isMobileCalendar, setIsMobileCalendar] = useState(isSmallViewport)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 640px)')
    const handleChange = () => setIsMobileCalendar(mq.matches)
    handleChange()
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  const displaySlotMinutes = isMobileCalendar
    ? Math.max(bh.slotDurationMinutes, 30)
    : bh.slotDurationMinutes
  const slotIso = minutesToSlotDuration(displaySlotMinutes)
  const snapIso = minutesToSlotDuration(bh.slotDurationMinutes)
  const slotMaxIso = addMinutesToTime(bh.workingEnd, displaySlotMinutes)
  const mobileScrollTime = useMemo(() => {
    if (view !== 'day' && view !== 'week') return `${bh.workingStart}:00`
    const todayYmd = salonTodayYmd()
    const currentYmd = format(currentDate, 'yyyy-MM-dd')
    const target =
      appointments
        .filter((a) =>
          view === 'day'
            ? a.date === currentYmd
            : a.date >= currentYmd &&
              a.date <= format(addDays(currentDate, 6), 'yyyy-MM-dd'),
        )
        .sort((a, b) =>
          `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`),
        )[0]?.startTime ??
      (currentYmd === todayYmd ? salonCurrentHm() : bh.workingStart)
    return subtractMinutes(target, 45)
  }, [appointments, bh.workingStart, currentDate, view])
  const scrollTime = isMobileCalendar
    ? mobileScrollTime
    : `${bh.workingStart}:00`
  const listVisibleRange = useMemo<
    ((rangeDate: Date) => DateRangeInput) | undefined
  >(() => {
    if (view !== 'list') return undefined
    return (rangeDate) => {
      const today = parseYmdToLocalDate(salonTodayYmd())
      const start = rangeDate < today ? today : rangeDate
      return { start, end: addDays(addMonths(start, 1), 1) }
    }
  }, [view])
  const appointmentsById = useMemo(() => {
    const m = new Map<string, AppointmentWithDetails>()
    for (const a of appointments) m.set(a.id, a)
    return m
  }, [appointments])

  const events: EventInput[] = useMemo(() => {
    const buildSingle = (apt: AppointmentWithDetails): EventInput => {
      const staffVar = staffAccentVar(apt.staff.color)
      const isDone = apt.status === 'completed'
      const isCancelled = apt.status === 'cancelled' || apt.status === 'no-show'
      const classNames: string[] = []
      if (isDone) classNames.push('fc-event--done')
      else if (isCancelled) classNames.push('fc-event--cancelled')
      const clientLabel = `${apt.client.isPlaceholder ? 'موقت · ' : ''}${apt.client.name}`
      return {
        id: apt.id,
        title: `${clientLabel} — ${appointmentServiceLabel(apt, view)}`,
        start: `${apt.date}T${apt.startTime}:00`,
        end: `${apt.date}T${apt.endTime}:00`,
        allDay: false,
        extendedProps: {
          kind: 'single',
          appointmentId: apt.id,
          staffColorVar: staffVar,
          timeLabel: formatPersianTime(apt.startTime),
          clientLabel,
          serviceLabel: appointmentServiceLabel(apt, view),
          staffName: apt.staff.name.split(' ')[0],
          clientInitials: personInitials(apt.client.name),
          durationLabel: `${toPersianDigits(durationMinutes(apt.startTime, apt.endTime))} د`,
          isDone,
          isCancelled,
        },
        backgroundColor: `color-mix(in oklch, ${staffVar} 55%, var(--card))`,
        borderColor: staffVar,
        classNames,
      }
    }

    if (view !== 'week') {
      // Agenda/list view shows only today onward, never past days.
      const source =
        view === 'list'
          ? appointments.filter((a) => a.date >= salonTodayYmd())
          : appointments
      return source.map(buildSingle)
    }

    // Week view: collapse time-overlapping appointments into one "N همزمان" pill.
    const clusters = buildConcurrencyClusters(appointments)
    const out: EventInput[] = []
    const emitted = new Set<string>()
    for (const apt of appointments) {
      const cluster = clusters.get(apt.id)
      if (!cluster || cluster.length < 2) {
        out.push(buildSingle(apt))
        continue
      }
      const ids = cluster.map((c) => c.id).sort()
      const key = ids[0]
      if (emitted.has(key)) continue
      emitted.add(key)
      const startMin = cluster.reduce(
        (min, c) => (c.startTime < min ? c.startTime : min),
        cluster[0].startTime,
      )
      const endMax = cluster.reduce(
        (max, c) => (c.endTime > max ? c.endTime : max),
        cluster[0].endTime,
      )
      const dotColors: string[] = []
      for (const c of cluster) {
        const v = staffAccentVar(c.staff.color)
        if (!dotColors.includes(v)) dotColors.push(v)
      }
      out.push({
        id: `cluster:${key}`,
        title: `${toPersianDigits(cluster.length)} همزمان`,
        start: `${cluster[0].date}T${startMin}:00`,
        end: `${cluster[0].date}T${endMax}:00`,
        allDay: false,
        extendedProps: {
          kind: 'cluster',
          clusterIds: ids,
          count: cluster.length,
          dotColors: dotColors.slice(0, 5),
        },
      })
    }
    return out
  }, [appointments, view])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const api = calendarRef.current?.getApi()
      if (!api) return
      const fcView = calendarViewToFc(view)
      if (api.view.type !== fcView) {
        api.changeView(fcView, currentDate)
      } else {
        api.gotoDate(currentDate)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [view, currentDate])

  useEffect(() => {
    if (!isMobileCalendar || (view !== 'day' && view !== 'week')) return
    const id = requestAnimationFrame(() => {
      calendarRef.current?.getApi().scrollToTime(mobileScrollTime)
    })
    return () => cancelAnimationFrame(id)
  }, [isMobileCalendar, mobileScrollTime, view])

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const start = format(arg.start, 'yyyy-MM-dd')
      const endInclusive = format(subDays(arg.end, 1), 'yyyy-MM-dd')
      onVisibleRangeChange(start, endInclusive, arg.view.activeStart)
    },
    [onVisibleRangeChange],
  )

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      const dateStr = format(arg.start, 'yyyy-MM-dd')
      const timeStr = format(arg.start, 'HH:mm')
      if (arg.allDay || arg.view.type === 'dayGridMonth') {
        onDaySummaryOpen?.(dateStr)
        arg.view.calendar.unselect()
        return
      }
      onSlotSelect(dateStr, timeStr)
      arg.view.calendar.unselect()
    },
    [onSlotSelect, onDaySummaryOpen],
  )

  const selectAllow = useCallback(
    (span: { start: Date; allDay: boolean }) => {
      if (span.allDay) return true
      const [endH, endM] = bh.workingEnd.split(':').map(Number)
      const boundary = new Date(span.start)
      boundary.setHours(endH, endM, 0, 0)
      return span.start < boundary
    },
    [bh.workingEnd],
  )

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      info.jsEvent.preventDefault()
      if (info.view.type === 'dayGridMonth') {
        const id = info.event.extendedProps.appointmentId as string | undefined
        const apt = id ? appointmentsById.get(id) : null
        if (apt) onDaySummaryOpen?.(apt.date)
        return
      }
      if (info.event.extendedProps.kind === 'cluster') {
        const ids =
          (info.event.extendedProps.clusterIds as string[] | undefined) ?? []
        const resolved = ids
          .map((cid) => appointmentsById.get(cid))
          .filter((a): a is AppointmentWithDetails => Boolean(a))
        if (resolved.length > 0) onClusterClick?.(resolved)
        return
      }
      const id = info.event.extendedProps.appointmentId as string | undefined
      if (!id) return
      const apt = appointmentsById.get(id)
      if (apt) onEventClick(apt)
    },
    [appointmentsById, onDaySummaryOpen, onEventClick, onClusterClick],
  )

  const handleDateClick = useCallback(
    (arg: { date: Date; dateStr: string; view: { type: string } }) => {
      if (arg.view.type === 'dayGridMonth') {
        onDaySummaryOpen?.(format(arg.date, 'yyyy-MM-dd'))
      } else {
        onSlotSelect(format(arg.date, 'yyyy-MM-dd'), format(arg.date, 'HH:mm'))
      }
    },
    [onDaySummaryOpen, onSlotSelect],
  )

  return (
    <div
      className={cn(
        'salon-fullcalendar relative h-full min-h-[400px] flex-1',
        view === 'list' && 'salon-fullcalendar--list',
        className,
      )}
    >
      {isRefreshing && (
        <div
          className="calendar-refresh-layer pointer-events-none absolute inset-x-2 top-2 z-20 overflow-hidden rounded-md border border-border/60 bg-card/85 px-3 py-2 shadow-sm backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <span className="calendar-refresh-dot" aria-hidden="true" />
            <span>در حال به‌روزرسانی تقویم…</span>
          </div>
          <div
            className="calendar-refresh-bar mt-2 h-1 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <span />
          </div>
        </div>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={calendarViewToFc(view)}
        initialDate={currentDate}
        locale={faLocale}
        headerToolbar={false}
        views={{
          listUpcomingMonth: {
            type: 'list',
            duration: { months: 1 },
          },
        }}
        visibleRange={listVisibleRange}
        events={events}
        height="100%"
        direction="rtl"
        firstDay={6}
        slotDuration={slotIso}
        snapDuration={snapIso}
        scrollTime={scrollTime}
        scrollTimeReset
        slotMinTime={`${bh.workingStart}:00`}
        slotMaxTime={slotMaxIso}
        allDaySlot={false}
        nowIndicator
        selectable={!readOnly}
        selectMirror={!readOnly}
        slotEventOverlap
        selectOverlap
        selectAllow={readOnly ? () => false : selectAllow}
        select={readOnly ? undefined : handleDateSelect}
        dateClick={readOnly && !onDaySummaryOpen ? undefined : handleDateClick}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        // Use HTML custom content (not React nodes) so @fullcalendar/react avoids flushSync
        // during lifecycle — see fullcalendar#7448 / React 18+ strict rendering.
        dayHeaderContent={({ date }) => {
          const { weekday, day } = formatPersianDayHeaderCompact(date)
          return {
            html: `<div class="day-header-compact"><span class="day-header-weekday">${escapeHtml(weekday)}</span><span class="day-header-num">${escapeHtml(day)}</span></div>`,
          }
        }}
        dayCellContent={(arg) => {
          if (arg.view.type !== 'dayGridMonth') {
            return {
              html: `<span class="fc-daygrid-day-number">${escapeHtml(arg.dayNumberText)}</span>`,
            }
          }
          return {
            html: `<span class="fc-daygrid-day-number">${escapeHtml(formatPersianDayNumber(fcDayCellToDate(arg)))}</span>`,
          }
        }}
        dayCellDidMount={(arg) => {
          if (arg.view.type !== 'dayGridMonth') return
          arg.el.setAttribute('role', 'button')
          arg.el.setAttribute('tabindex', '0')
          arg.el.setAttribute(
            'aria-label',
            `مشاهده روز ${format(arg.date, 'yyyy-MM-dd')}`,
          )
          const openDay = () =>
            onDaySummaryOpen?.(format(arg.date, 'yyyy-MM-dd'))
          arg.el.onkeydown = (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            openDay()
          }
        }}
        slotLabelContent={({ date }) => ({
          html: `<span>${escapeHtml(formatPersianTimeHm(date))}</span>`,
        })}
        eventContent={(arg) => {
          const viewType = arg.view.type
          if (viewType === 'dayGridMonth') return undefined
          if (arg.event.extendedProps.kind === 'cluster') {
            const count = arg.event.extendedProps.count as number
            const dotColors =
              (arg.event.extendedProps.dotColors as string[] | undefined) ?? []
            const dots = dotColors
              .map(
                (c) =>
                  `<span class="fc-apt-cluster-dot" style="background:${c}"></span>`,
              )
              .join('')
            return {
              html: `<div class="fc-apt-cluster">
                <span class="fc-apt-cluster-head">
                  <span class="fc-apt-cluster-count">${escapeHtml(toPersianDigits(count))}</span>
                  <span class="fc-apt-cluster-label">همزمان</span>
                </span>
                ${dots ? `<span class="fc-apt-cluster-dots">${dots}</span>` : ''}
              </div>`,
            }
          }
          const p = arg.event.extendedProps as {
            timeLabel: string
            clientLabel: string
            serviceLabel: string
            staffName: string
            clientInitials: string
            durationLabel: string
            staffColorVar: string
            isDone: boolean
            isCancelled: boolean
          }
          if (viewType.startsWith('list')) {
            const avatarStyle = `background:color-mix(in oklch, ${p.staffColorVar} 16%, transparent);color:${p.staffColorVar}`
            return {
              html: `<div class="fc-apt-row">
                <span class="fc-apt-row-time">
                  <span class="fc-apt-row-time-h" dir="ltr">${escapeHtml(p.timeLabel)}</span>
                  <span class="fc-apt-row-time-d">${escapeHtml(p.durationLabel)}</span>
                </span>
                <span class="fc-apt-avatar" style="${avatarStyle}">${escapeHtml(p.clientInitials)}</span>
                <span class="fc-apt-row-main">
                  <span class="fc-apt-row-client">${escapeHtml(p.clientLabel)}</span>
                  <span class="fc-apt-row-sub">${escapeHtml(p.serviceLabel)} · ${escapeHtml(p.staffName)}</span>
                </span>
                <span class="fc-apt-row-chevron" dir="ltr" aria-hidden="true">‹</span>
              </div>`,
            }
          }
          return {
            html: `<div class="fc-apt-block">
              <span class="fc-apt-time">${escapeHtml(p.timeLabel)}</span>
              <span class="fc-apt-client">${escapeHtml(p.clientLabel)}</span>
              <span class="fc-apt-svc">${escapeHtml(p.serviceLabel)}</span>
            </div>`,
          }
        }}
        dayMaxEvents
        stickyHeaderDates
        businessHours={{
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: bh.workingStart,
          endTime: bh.workingEnd,
        }}
        eventTimeFormat={(arg) => {
          const s = expandedZonedToDate(arg.start)
          const e = arg.end ? expandedZonedToDate(arg.end) : s
          return `${formatPersianTimeHm(s)} – ${formatPersianTimeHm(e)}`
        }}
        listDayFormat={(arg) =>
          formatPersianListDayRelative(expandedZonedToDate(arg.date))
        }
        listDaySideFormat={false}
        noEventsText={
          view === 'list'
            ? 'نوبتی در ماه پیش رو نیست'
            : 'نوبتی در این بازه نیست'
        }
        eventDisplay="block"
        displayEventEnd
      />
    </div>
  )
})
