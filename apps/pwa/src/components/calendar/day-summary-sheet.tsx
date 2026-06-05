import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import { CalendarDays, Clock, Plus } from 'lucide-react'
import { Button } from '@repo/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/sheet'
import type { AppointmentWithDetails } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import {
  formatPersianTime,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import { formatPersianFullDate } from '@repo/salon-core/jalali-display'
import { cn } from '@repo/ui/utils'

interface DaySummarySheetProps {
  date: string | null
  appointments: AppointmentWithDetails[]
  canCreate: boolean
  onOpenChange: (open: boolean) => void
  onCreateAppointment: (date: string) => void
  onOpenAppointment: (appointment: AppointmentWithDetails) => void
}

function staffColorVar(color: string): string {
  return `var(--calendar-${normalizeCalendarColorId(color)})`
}

function appointmentSort(a: AppointmentWithDetails, b: AppointmentWithDetails) {
  return (
    a.startTime.localeCompare(b.startTime) ||
    a.staff.name.localeCompare(b.staff.name, 'fa')
  )
}

export function DaySummarySheet({
  date,
  appointments,
  canCreate,
  onOpenChange,
  onCreateAppointment,
  onOpenAppointment,
}: DaySummarySheetProps) {
  const sorted = useMemo(
    () =>
      date
        ? appointments
            .filter((appointment) => appointment.date === date)
            .sort(appointmentSort)
        : [],
    [appointments, date],
  )
  const dateLabel = date ? formatPersianFullDate(parseISO(date)) : ''
  const open = Boolean(date)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[86vh] rounded-t-[24px] border-border/70 p-0 sm:inset-x-auto sm:left-4 sm:right-auto sm:bottom-4 sm:max-h-[calc(100vh-2rem)] sm:w-[420px] sm:rounded-[24px] sm:border"
      >
        <SheetHeader className="border-b border-border/50 px-5 pb-4 pt-5 text-right">
          <div className="flex items-center justify-end gap-2 text-muted-foreground">
            <SheetTitle className="text-[15px] font-bold text-foreground">
              {dateLabel}
            </SheetTitle>
            <CalendarDays className="size-4" aria-hidden="true" />
          </div>
          <SheetDescription>
            {sorted.length > 0
              ? `${toPersianDigits(sorted.length)} نوبت در این روز`
              : 'هنوز نوبتی برای این روز ثبت نشده است'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {sorted.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {sorted.map((appointment) => {
                const color = staffColorVar(appointment.staff.color)
                const isInactive =
                  appointment.status === 'cancelled' ||
                  appointment.status === 'no-show'
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onOpenAppointment(appointment)}
                    aria-label={`باز کردن نوبت ${appointment.client.name}`}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3 text-right shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span
                      className={cn(
                        'h-12 w-1.5 shrink-0 rounded-full',
                        isInactive && 'opacity-55',
                      )}
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm font-bold text-foreground',
                          isInactive && 'text-muted-foreground line-through',
                        )}
                      >
                        {appointment.client.isPlaceholder ? 'موقت · ' : ''}
                        {appointment.client.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {appointment.bookedServiceName} ·{' '}
                        {appointment.staff.name}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1" dir="ltr">
                        {formatPersianTime(appointment.startTime)}
                        <Clock className="size-3.5" aria-hidden="true" />
                      </span>
                      <span
                        className="text-[11px] text-muted-foreground"
                        dir="ltr"
                      >
                        {formatPersianTime(appointment.endTime)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                این روز خالی است
              </p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                برای ساخت نوبت جدید از دکمه پایین استفاده کنید.
              </p>
            </div>
          )}
        </div>

        {canCreate && date && (
          <SheetFooter className="border-t border-border/50 bg-card/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
            <Button
              type="button"
              onClick={() => onCreateAppointment(date)}
              className="min-h-12 gap-2 rounded-2xl"
              aria-label="نوبت جدید برای این روز"
            >
              <Plus className="size-4" aria-hidden="true" />
              نوبت جدید برای این روز
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
