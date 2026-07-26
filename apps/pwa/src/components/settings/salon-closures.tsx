import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock3, Plus, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { faIR } from 'react-day-picker/persian'
import { ApiError } from '@repo/api-client'
import { Calendar } from '@repo/ui/calendar'
import { Button } from '@repo/ui/button'
import { toast } from '@repo/ui/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/alert-dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'
import { formatJalaliDate } from '@repo/salon-core/jalali'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import {
  salonClosuresQueryOptions,
  useCloseSalonDatesMutation,
  useReopenSalonDatesMutation,
  type ClosureWarning,
} from '#/lib/settings-queries'

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fromYmd(value: string) {
  return new Date(`${value}T12:00:00`)
}

function datesInRange(selection: DateRange | undefined) {
  if (!selection?.from) return []
  const start = toYmd(selection.from)
  const end = toYmd(selection.to ?? selection.from)
  const dates: string[] = []
  for (let date = start; date <= end; date = addDaysYmd(date, 1)) {
    dates.push(date)
  }
  return dates
}

function warningFrom(error: unknown): ClosureWarning | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const payload = error.payload
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('code' in payload) ||
    payload.code !== 'CLOSURE_CONFIRMATION_REQUIRED' ||
    !('appointmentCount' in payload) ||
    !('appointmentsByDate' in payload)
  ) {
    return null
  }
  return payload as ClosureWarning
}

export function SalonClosures({ workingDays }: { workingDays: number }) {
  const today = salonTodayYmd()
  const closuresQuery = useQuery(salonClosuresQueryOptions())
  const closeDates = useCloseSalonDatesMutation()
  const reopenDates = useReopenSalonDatesMutation()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selection, setSelection] = useState<DateRange>()
  const [warning, setWarning] = useState<ClosureWarning | null>(null)
  const closures = closuresQuery.data ?? []
  const selectedDates = useMemo(() => datesInRange(selection), [selection])
  const weeklyClosedDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, jsDay) => jsDay).filter(
        (jsDay) => (workingDays & (1 << ((jsDay + 1) % 7))) === 0,
      ),
    [workingDays],
  )

  const closeSelection = async (confirmed = false) => {
    if (!selection?.from) return
    const startDate = toYmd(selection.from)
    const endDate = toYmd(selection.to ?? selection.from)
    try {
      await closeDates.mutateAsync({ startDate, endDate, confirmed })
      setCalendarOpen(false)
      setSelection(undefined)
      setWarning(null)
    } catch (error) {
      const nextWarning = warningFrom(error)
      if (nextWarning) {
        setCalendarOpen(false)
        setWarning(nextWarning)
      } else {
        toast({
          variant: 'destructive',
          title:
            error instanceof Error ? error.message : 'بستن روزها انجام نشد',
        })
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          روزهای غیرقابل رزرو
        </span>
        <Button className="rounded-xl" onClick={() => setCalendarOpen(true)}>
          <Plus />
          افزودن
        </Button>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-line-soft bg-card">
        <div className="border-b border-line-soft px-4 py-3">
          <div className="text-sm font-bold">تعطیلی‌های سالن</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {toPersianDigits(closures.length)} روز بسته ثبت شده است.
          </div>
        </div>
        {closuresQuery.isPending ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            در حال بارگذاری…
          </div>
        ) : closures.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            هنوز روزی بسته نشده است.
          </div>
        ) : (
          <div className="divide-y divide-line-soft px-4">
            {closures.map((date) => (
              <div key={date} className="flex min-h-14 items-center gap-3 py-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
                  <CalendarDays className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    {formatJalaliDate(date)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    غیرقابل رزرو برای کل سالن
                  </div>
                </div>
                <Button
                  variant="ghost"
                  disabled={reopenDates.isPending}
                  onClick={() =>
                    reopenDates.mutate({ startDate: date, endDate: date })
                  }
                >
                  باز کردن
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Drawer open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>افزودن روزهای غیرقابل رزرو</DrawerTitle>
            <DrawerDescription>
              یک روز یا یک بازه را از تقویم انتخاب کنید.
            </DrawerDescription>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-md overflow-y-auto px-3 py-2">
            <Calendar
              mode="range"
              locale={faIR}
              dir="rtl"
              fixedWeeks
              selected={selection}
              onSelect={setSelection}
              defaultMonth={fromYmd(today)}
              disabled={{ before: fromYmd(today) }}
              modifiers={{
                unavailable: closures.map(fromYmd),
                weeklyClosed: { dayOfWeek: weeklyClosedDays },
              }}
              modifiersClassNames={{
                unavailable:
                  '[&_button]:ring-1 [&_button]:ring-inset [&_button]:ring-destructive/70',
                weeklyClosed:
                  '[&:not([data-selected=true])_button]:bg-muted [&:not([data-selected=true])_button]:text-muted-foreground',
              }}
              className="mx-auto min-h-[390px] w-full rounded-xl border border-line-soft"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/70 p-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <i className="size-3 rounded-full bg-accent ring-1 ring-primary" />
                امروز
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-3 rounded-full bg-primary" />
                انتخاب‌شده
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-3 rounded-full bg-muted-foreground/30" />
                تعطیل هفتگی
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-3 rounded-full ring-1 ring-destructive" />
                غیرقابل رزرو
              </span>
            </div>
          </div>
          <DrawerFooter>
            <Button
              size="lg"
              disabled={selectedDates.length === 0 || closeDates.isPending}
              onClick={() => void closeSelection()}
            >
              ثبت {toPersianDigits(selectedDates.length)} روز غیرقابل رزرو
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={warning !== null}
        onOpenChange={(open) => !open && setWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              این بازه {toPersianDigits(warning?.appointmentCount ?? 0)} نوبت
              فعال دارد
            </AlertDialogTitle>
            <AlertDialogDescription>
              نوبت‌های فعلی بدون تغییر می‌مانند و رزرو جدید برای این روزها بسته
              می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-xl bg-muted p-3 text-sm">
            {warning?.appointmentsByDate.map((row) => (
              <div key={row.date} className="flex items-center justify-between">
                <span>{formatJalaliDate(row.date)}</span>
                <span className="flex items-center gap-1 text-amber-fg">
                  <Clock3 className="size-3" />
                  {toPersianDigits(row.count)} نوبت
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X />
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={closeDates.isPending}
              onClick={() => void closeSelection(true)}
            >
              بستن روزها
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
