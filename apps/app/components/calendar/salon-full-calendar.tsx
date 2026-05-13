'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import type { DateSelectArg, DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core'
import faLocale from '@fullcalendar/core/locales/fa'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { format, subDays } from 'date-fns'
import { AppointmentWithDetails, CalendarView, WORKING_HOURS, type BusinessHours } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import {
  expandedZonedToDate,
  formatPersianDayHeaderCompact,
  formatPersianDayNumber,
  formatPersianListDay,
  formatPersianTimeHm,
} from '@repo/salon-core/jalali-display'
import { cn } from '@repo/ui/utils'
import { formatCompactServiceLabel } from '@/components/services/service-catalog-groups'

function staffColorToCssVar(staffColor: string): string {
  return `var(--calendar-${normalizeCalendarColorId(staffColor)})`
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
    return new Date(d[0] as number, (d[1] as number) - 1, d[2] as number, 12, 0, 0, 0)
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
      return 'listWeek'
    default:
      return 'timeGridWeek'
  }
}

function minutesToSlotDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

export interface SalonFullCalendarProps {
  className?: string
  appointments: AppointmentWithDetails[]
  view: CalendarView
  currentDate: Date
  onVisibleRangeChange: (start: string, endInclusive: string, activeStart: Date) => void
  onSlotSelect: (dateStr: string, timeStr: string) => void
  onEventClick: (appointment: AppointmentWithDetails) => void
  /** From DB / API; falls back to WORKING_HOURS if omitted */
  businessHours?: BusinessHours
  /** Staff: view-only calendar (no slot selection). */
  readOnly?: boolean
  /** Non-blocking refresh state for range navigation and background revalidation. */
  isRefreshing?: boolean
}

export function SalonFullCalendar({
  className,
  appointments,
  view,
  currentDate,
  onVisibleRangeChange,
  onSlotSelect,
  onEventClick,
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
  const slotIso = minutesToSlotDuration(bh.slotDurationMinutes)
  const appointmentsById = useMemo(() => {
    const m = new Map<string, AppointmentWithDetails>()
    for (const a of appointments) m.set(a.id, a)
    return m
  }, [appointments])

  const events: EventInput[] = useMemo(
    () =>
      appointments.map((apt) => ({
        id: apt.id,
        title: `${apt.client.isPlaceholder ? 'موقت · ' : ''}${apt.client.name} — ${formatCompactServiceLabel(apt.service)}`,
        start: `${apt.date}T${apt.startTime}:00`,
        end: `${apt.date}T${apt.endTime}:00`,
        allDay: false,
        extendedProps: { appointmentId: apt.id },
        backgroundColor: staffColorToCssVar(apt.staff.color),
        borderColor: staffColorToCssVar(apt.staff.color),
      })),
    [appointments]
  )

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

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const start = format(arg.start, 'yyyy-MM-dd')
      const endInclusive = format(subDays(arg.end, 1), 'yyyy-MM-dd')
      onVisibleRangeChange(start, endInclusive, arg.view.activeStart)
    },
    [onVisibleRangeChange]
  )

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      const dateStr = format(arg.start, 'yyyy-MM-dd')
      let timeStr = format(arg.start, 'HH:mm')
      if (arg.allDay || arg.view.type === 'dayGridMonth') {
        timeStr = bh.workingStart
      }
      onSlotSelect(dateStr, timeStr)
      arg.view.calendar.unselect()
    },
    [onSlotSelect, bh.workingStart]
  )

  const selectAllow = useCallback(
    (span: { start: Date; allDay: boolean }) => {
      if (span.allDay) return true
      const [endH, endM] = bh.workingEnd.split(':').map(Number)
      const boundary = new Date(span.start)
      boundary.setHours(endH, endM, 0, 0)
      return span.start < boundary
    },
    [bh.workingEnd]
  )

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      info.jsEvent.preventDefault()
      const id = info.event.extendedProps.appointmentId as string | undefined
      if (!id) return
      const apt = appointmentsById.get(id)
      if (apt) onEventClick(apt)
    },
    [appointmentsById, onEventClick]
  )

  const handleDateClick = useCallback(
    (arg: { date: Date; dateStr: string; view: { type: string } }) => {
      if (arg.view.type === 'dayGridMonth') {
        onSlotSelect(format(arg.date, 'yyyy-MM-dd'), bh.workingStart)
      } else {
        onSlotSelect(format(arg.date, 'yyyy-MM-dd'), format(arg.date, 'HH:mm'))
      }
    },
    [onSlotSelect, bh.workingStart]
  )

  return (
    <div className={cn('salon-fullcalendar relative h-full min-h-[400px] flex-1', className)}>
      {isRefreshing && (
        <div
          className="calendar-refresh-layer pointer-events-none absolute inset-x-2 top-2 z-20 overflow-hidden rounded-md border border-border/60 bg-card/85 px-3 py-2 shadow-sm backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <span className="calendar-refresh-dot" aria-hidden="true" />
            <span>در حال به‌روزرسانی تقویم…</span>
          </div>
          <div className="calendar-refresh-bar mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
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
        events={events}
        height="100%"
        direction="rtl"
        firstDay={6}
        slotDuration={slotIso}
        slotMinTime={`${bh.workingStart}:00`}
        slotMaxTime={`${bh.workingEnd}:00`}
        allDaySlot={false}
        nowIndicator
        selectable={!readOnly}
        selectMirror={!readOnly}
        slotEventOverlap
        selectOverlap
        selectAllow={readOnly ? () => false : selectAllow}
        select={readOnly ? undefined : handleDateSelect}
        dateClick={readOnly ? undefined : handleDateClick}
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
        slotLabelContent={({ date }) => ({
          html: `<span>${escapeHtml(formatPersianTimeHm(date))}</span>`,
        })}
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
        listDayFormat={(arg) => formatPersianListDay(expandedZonedToDate(arg.date))}
        listDaySideFormat={false}
        noEventsText="نوبتی در این بازه نیست"
        eventDisplay="block"
        displayEventEnd
      />
    </div>
  )
}
