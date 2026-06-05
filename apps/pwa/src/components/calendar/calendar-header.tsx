import {
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@repo/ui/button'
import type { CalendarView } from '@repo/salon-core/types'
import {
  formatPersianFullDate,
  formatPersianMonthYear,
  formatPersianWeekRange,
} from '@repo/salon-core/jalali-display'
import { brand } from '@repo/brand'
import { SalooraMark } from '#/components/brand/saloora-mark'

interface CalendarHeaderProps {
  titleAnchor: Date
  navigationDate: Date
  view: CalendarView
  onDateChange: (date: Date) => void
  onToday: () => void
}

export function CalendarHeader({
  titleAnchor,
  navigationDate,
  view,
  onDateChange,
  onToday,
}: CalendarHeaderProps) {
  const navigate = (direction: 'prev' | 'next') => {
    const d = navigationDate
    switch (view) {
      case 'day':
        onDateChange(direction === 'prev' ? subDays(d, 1) : addDays(d, 1))
        break
      case 'week':
        onDateChange(direction === 'prev' ? subWeeks(d, 1) : addWeeks(d, 1))
        break
      case 'list':
        onDateChange(direction === 'prev' ? subMonths(d, 1) : addMonths(d, 1))
        break
      case 'month':
        onDateChange(direction === 'prev' ? subMonths(d, 1) : addMonths(d, 1))
        break
    }
  }

  const getTitle = () => {
    switch (view) {
      case 'day':
        return formatPersianFullDate(titleAnchor)
      case 'week':
        return formatPersianWeekRange(titleAnchor, addDays(titleAnchor, 6))
      case 'list':
        return formatPersianWeekRange(titleAnchor, addMonths(titleAnchor, 1))
      case 'month':
        return formatPersianMonthYear(navigationDate)
    }
  }

  return (
    <header className="calendar-header-gradient safe-area-pt flex items-center gap-2 px-3 py-2 sm:px-4">
      <div className="flex items-center gap-1.5 shrink-0">
        <SalooraMark className="size-8 rounded-xl" />
        <span className="hidden text-base font-bold text-primary tracking-tight ml-1 min-[430px]:inline">
          {brand.name.fa}
        </span>
      </div>

      <div className="flex-1 min-w-0 text-center">
        <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
          {getTitle()}
        </p>
      </div>

      <div dir="ltr" className="flex items-center gap-2 touch:gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate('prev')}
          type="button"
          className="h-11 w-11 rounded-2xl touch-manipulation"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">قبلی</span>
        </Button>
        <button
          onClick={onToday}
          className="min-h-11 rounded-2xl px-3 py-2 text-sm font-semibold text-primary transition-colors touch-manipulation hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          type="button"
        >
          امروز
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate('next')}
          type="button"
          className="h-11 w-11 rounded-2xl touch-manipulation"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">بعدی</span>
        </Button>
      </div>
    </header>
  )
}
