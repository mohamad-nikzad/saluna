'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from 'lucide-react'
import { Button } from './button'
import {
  DrawerNested,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from './drawer'
import { cn } from './utils'
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  parseGregorianToJalali,
  jalaliToGregorianStr,
  jalaliMonthLength,
  jalaliMonthStartDow,
  formatJalaliDate,
  toJalali,
} from '@repo/salon-core/jalali'

interface JalaliDatePickerProps {
  value: string
  onChange: (gregorianDate: string) => void
  id?: string
  required?: boolean
  className?: string
  /** Inclusive Gregorian YMD lower bound; earlier days are disabled. */
  minDate?: string
  /** Inclusive Gregorian YMD upper bound; later days are disabled. */
  maxDate?: string
  /** Controlled open state for programmatic open (e.g. “add date” actions). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Dates to show as closed and prevent selecting. */
  unavailableDates?: readonly string[]
  /** Keeps an already-selected closed date valid, for editing in place. */
  allowUnavailableValue?: boolean
}

const numFmt = new Intl.NumberFormat('fa-IR')
const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const NO_UNAVAILABLE_DATES: readonly string[] = []

function isValidYmd(value: string | undefined): value is string {
  return typeof value === 'string' && YMD_PATTERN.test(value)
}

function isDateOutOfRange(
  ymd: string,
  minDate?: string,
  maxDate?: string,
): boolean {
  if (isValidYmd(minDate) && ymd < minDate) return true
  if (isValidYmd(maxDate) && ymd > maxDate) return true
  return false
}

function localTodayYmd(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function JalaliDatePicker({
  value,
  onChange,
  id,
  className,
  minDate,
  maxDate,
  open: openProp,
  onOpenChange,
  unavailableDates = NO_UNAVAILABLE_DATES,
  allowUnavailableValue = false,
}: JalaliDatePickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = openProp ?? uncontrolledOpen

  const selected = useMemo(() => {
    if (!value) return null
    return parseGregorianToJalali(value)
  }, [value])
  const unavailable = useMemo(
    () => new Set(unavailableDates),
    [unavailableDates],
  )

  const todayJalali = useMemo(() => {
    const now = new Date()
    return toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }, [])

  const [viewYear, setViewYear] = useState(() => selected?.jy ?? todayJalali.jy)
  const [viewMonth, setViewMonth] = useState(
    () => selected?.jm ?? todayJalali.jm,
  )

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        const fallbackYmd =
          (isValidYmd(value) && !isDateOutOfRange(value, minDate, maxDate)
            ? value
            : null) ??
          (isValidYmd(minDate) ? minDate : null) ??
          localTodayYmd()
        const target = parseGregorianToJalali(fallbackYmd)
        setViewYear(target.jy)
        setViewMonth(target.jm)
      }
      onOpenChange?.(isOpen)
      if (openProp === undefined) setUncontrolledOpen(isOpen)
    },
    [value, minDate, maxDate, onOpenChange, openProp],
  )

  const canGoPrev = useMemo(() => {
    if (!isValidYmd(minDate)) return true
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear
    const lastDay = jalaliMonthLength(prevYear, prevMonth)
    const lastYmd = jalaliToGregorianStr(prevYear, prevMonth, lastDay)
    return lastYmd >= minDate
  }, [minDate, viewYear, viewMonth])

  const canGoNext = useMemo(() => {
    if (!isValidYmd(maxDate)) return true
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear
    const firstYmd = jalaliToGregorianStr(nextYear, nextMonth, 1)
    return firstYmd <= maxDate
  }, [maxDate, viewYear, viewMonth])

  const goPrev = useCallback(() => {
    if (!canGoPrev) return
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1)
        return 12
      }
      return m - 1
    })
  }, [canGoPrev])

  const goNext = useCallback(() => {
    if (!canGoNext) return
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1)
        return 1
      }
      return m + 1
    })
  }, [canGoNext])

  const handleDayClick = useCallback(
    (day: number) => {
      const ymd = jalaliToGregorianStr(viewYear, viewMonth, day)
      if (
        isDateOutOfRange(ymd, minDate, maxDate) ||
        (unavailable.has(ymd) && (!allowUnavailableValue || ymd !== value))
      )
        return
      onChange(ymd)
      handleOpen(false)
    },
    [
      viewYear,
      viewMonth,
      minDate,
      maxDate,
      unavailable,
      allowUnavailableValue,
      value,
      onChange,
      handleOpen,
    ],
  )

  const daysInMonth = jalaliMonthLength(viewYear, viewMonth)
  const startDow = jalaliMonthStartDow(viewYear, viewMonth)

  const weeks: (number | null)[][] = useMemo(() => {
    const cells: (number | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const rows: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [startDow, daysInMonth])

  const displayText = value ? formatJalaliDate(value) : ''
  const todayYmd = localTodayYmd()
  const todaySelectable =
    !isDateOutOfRange(todayYmd, minDate, maxDate) &&
    (!unavailable.has(todayYmd) ||
      (allowUnavailableValue && todayYmd === value))

  return (
    <>
      <button
        type="button"
        id={id}
        aria-label={
          unavailable.has(value)
            ? `تاریخ ${displayText}، سالن بسته است`
            : displayText
              ? `تاریخ ${displayText}`
              : 'انتخاب تاریخ'
        }
        onClick={() => handleOpen(true)}
        className={cn(
          'border-input bg-blush-soft dark:bg-input/30 flex h-9 touch:h-11 w-full min-w-0 items-center justify-between rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          !value && 'text-muted-foreground',
          unavailable.has(value) && 'border-destructive/60 text-destructive',
          className,
        )}
      >
        <span>
          {displayText || 'انتخاب تاریخ'}
          {unavailable.has(value) ? ' · سالن بسته است' : ''}
        </span>
        <CalendarIcon className="h-4 w-4 opacity-50" />
      </button>

      <DrawerNested open={open} onOpenChange={handleOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>انتخاب تاریخ</DrawerTitle>
            <DrawerDescription>روز مورد نظر را انتخاب کنید</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-col gap-2 px-4 pb-2">
            {/* Month/year nav */}
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-manipulation"
                aria-label="ماه بعد"
                disabled={!canGoNext}
                onClick={goNext}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </Button>
              <span className="text-base font-semibold select-none">
                {JALALI_MONTHS[viewMonth - 1]} {numFmt.format(viewYear)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-manipulation"
                aria-label="ماه قبل"
                disabled={!canGoPrev}
                onClick={goPrev}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </Button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center">
              {JALALI_WEEKDAYS_SHORT.map((wd) => (
                <div
                  key={wd}
                  className="text-muted-foreground py-1 text-xs font-medium select-none"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day grid — 44px touch targets (matches calendar cell size) */}
            <div className="flex flex-col gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day, di) => {
                    if (day === null) {
                      return <div key={di} className="h-11" />
                    }

                    const ymd = jalaliToGregorianStr(viewYear, viewMonth, day)
                    const disabled = isDateOutOfRange(ymd, minDate, maxDate)
                    const isUnavailable = unavailable.has(ymd)
                    const selectionDisabled =
                      disabled ||
                      (isUnavailable &&
                        (!allowUnavailableValue || ymd !== value))

                    const isToday =
                      viewYear === todayJalali.jy &&
                      viewMonth === todayJalali.jm &&
                      day === todayJalali.jd

                    const isSelected =
                      selected &&
                      viewYear === selected.jy &&
                      viewMonth === selected.jm &&
                      day === selected.jd

                    return (
                      <button
                        key={di}
                        type="button"
                        disabled={selectionDisabled}
                        aria-disabled={selectionDisabled || undefined}
                        aria-label={
                          isUnavailable
                            ? `${numFmt.format(day)}، سالن بسته است`
                            : undefined
                        }
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          'h-11 rounded-xl text-sm font-medium transition-colors touch-manipulation',
                          selectionDisabled
                            ? 'cursor-not-allowed text-muted-foreground/35'
                            : 'hover:bg-accent hover:text-accent-foreground active:scale-95',
                          !selectionDisabled &&
                            isToday &&
                            !isSelected &&
                            'bg-accent text-accent-foreground ring-1 ring-primary/30',
                          !selectionDisabled &&
                            isSelected &&
                            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm',
                          selectionDisabled &&
                            isToday &&
                            'ring-1 ring-border/40',
                          isUnavailable &&
                            'ring-1 ring-inset ring-destructive/70',
                        )}
                      >
                        {numFmt.format(day)}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              className="touch-manipulation"
              disabled={!todaySelectable}
              onClick={() => {
                if (!todaySelectable) return
                onChange(todayYmd)
                handleOpen(false)
              }}
            >
              امروز
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </DrawerNested>
    </>
  )
}
