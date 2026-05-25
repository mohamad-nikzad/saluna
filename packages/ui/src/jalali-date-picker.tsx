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
}

const numFmt = new Intl.NumberFormat('fa-IR')

export function JalaliDatePicker({ value, onChange, id, className }: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => {
    if (!value) return null
    return parseGregorianToJalali(value)
  }, [value])

  const todayJalali = useMemo(() => {
    const now = new Date()
    return toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }, [])

  const [viewYear, setViewYear] = useState(() => selected?.jy ?? todayJalali.jy)
  const [viewMonth, setViewMonth] = useState(() => selected?.jm ?? todayJalali.jm)

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        const target = selected ?? todayJalali
        setViewYear(target.jy)
        setViewMonth(target.jm)
      }
      setOpen(isOpen)
    },
    [selected, todayJalali],
  )

  const goPrev = useCallback(() => {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1)
        return 12
      }
      return m - 1
    })
  }, [])

  const goNext = useCallback(() => {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1)
        return 1
      }
      return m + 1
    })
  }, [])

  const handleDayClick = useCallback(
    (day: number) => {
      onChange(jalaliToGregorianStr(viewYear, viewMonth, day))
      setOpen(false)
    },
    [viewYear, viewMonth, onChange],
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

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => handleOpen(true)}
        className={cn(
          'border-input bg-blush-soft dark:bg-input/30 flex h-9 w-full items-center justify-between rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <span>{displayText || 'انتخاب تاریخ'}</span>
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
                className="h-10 w-10 touch-manipulation"
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
                className="h-10 w-10 touch-manipulation"
                onClick={goPrev}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </Button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center">
              {JALALI_WEEKDAYS_SHORT.map((wd) => (
                <div key={wd} className="text-muted-foreground py-1 text-xs font-medium select-none">
                  {wd}
                </div>
              ))}
            </div>

            {/* Day grid — 44px minimum touch targets */}
            <div className="flex flex-col gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day, di) => {
                    if (day === null) {
                      return <div key={di} className="aspect-square" />
                    }

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
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          'aspect-square min-h-[44px] rounded-xl text-sm font-medium transition-colors touch-manipulation active:scale-95',
                          'hover:bg-accent hover:text-accent-foreground',
                          isToday && !isSelected && 'bg-accent text-accent-foreground ring-1 ring-primary/30',
                          isSelected &&
                            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm',
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
              onClick={() => {
                const now = new Date()
                const y = now.getFullYear()
                const m = now.getMonth() + 1
                const d = now.getDate()
                onChange(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
                setOpen(false)
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
