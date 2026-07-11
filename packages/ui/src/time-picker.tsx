'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Clock } from 'lucide-react'
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

const ITEM_HEIGHT = 44
const VISIBLE_COUNT = 5
const PADDING = Math.floor(VISIBLE_COUNT / 2) * ITEM_HEIGHT

const persianDigits = (n: number, minDigits = 2) =>
  new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: minDigits }).format(n)

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function WheelColumn({
  items,
  value,
  onChange,
  formatItem,
}: {
  items: number[]
  value: number
  onChange: (v: number) => void
  formatItem: (v: number) => string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const suppressUpdate = useRef(false)

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'instant') => {
      if (!scrollRef.current) return
      suppressUpdate.current = true
      scrollRef.current.scrollTo({ top: index * ITEM_HEIGHT, behavior })
      setTimeout(
        () => {
          suppressUpdate.current = false
        },
        behavior === 'smooth' ? 300 : 50,
      )
    },
    [],
  )

  useEffect(() => {
    const idx = items.indexOf(value)
    if (idx >= 0) {
      requestAnimationFrame(() => scrollToIndex(idx))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (suppressUpdate.current) return
    const idx = items.indexOf(value)
    if (idx >= 0) scrollToIndex(idx, 'smooth')
  }, [value, items, scrollToIndex])

  const handleScroll = useCallback(() => {
    if (suppressUpdate.current) return
    clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      if (!scrollRef.current || suppressUpdate.current) return
      const idx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT)
      const clamped = Math.max(0, Math.min(items.length - 1, idx))
      if (items[clamped] !== value) {
        onChange(items[clamped])
      }
    }, 60)
  }, [items, value, onChange])

  const containerHeight = VISIBLE_COUNT * ITEM_HEIGHT

  return (
    <div
      className="relative isolate max-w-28 flex-1 overflow-hidden rounded-2xl"
      style={{ height: containerHeight }}
    >
      <div
        className="pointer-events-none absolute inset-x-1 z-0 rounded-full bg-accent/70 shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_6%,transparent)]"
        style={{ top: PADDING, height: ITEM_HEIGHT }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 rounded-t-2xl"
        style={{
          height: PADDING,
          background:
            'linear-gradient(to bottom, var(--color-card) 8%, color-mix(in oklch, var(--color-card) 88%, transparent) 46%, transparent)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-2xl"
        style={{
          height: PADDING,
          background:
            'linear-gradient(to top, var(--color-card) 8%, color-mix(in oklch, var(--color-card) 88%, transparent) 46%, transparent)',
        }}
      />

      <div
        ref={scrollRef}
        className="scrollbar-hide relative z-[1] h-full touch-pan-y overflow-y-auto overscroll-contain"
        style={{ scrollSnapType: 'y mandatory' }}
        onScroll={handleScroll}
      >
        {/* Top spacer */}
        <div style={{ height: PADDING }} />

        {items.map((item) => (
          <div
            key={item}
            className={cn(
              'flex items-center justify-center text-xl font-semibold tabular-nums transition-colors',
              item === value ? 'text-foreground' : 'text-muted-foreground/60',
            )}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center' }}
          >
            {formatItem(item)}
          </div>
        ))}

        {/* Bottom spacer */}
        <div style={{ height: PADDING }} />
      </div>
    </div>
  )
}

interface TimePickerProps {
  value: string
  onChange: (time: string) => void
  id?: string
  label?: string
}

export function TimePicker({ value, onChange, id, label }: TimePickerProps) {
  const [open, setOpen] = useState(false)

  const [h, m] = value.split(':').map(Number)
  const [tempHour, setTempHour] = useState(h)
  const [tempMinute, setTempMinute] = useState(m)

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      const [ch, cm] = value.split(':').map(Number)
      setTempHour(ch)
      setTempMinute((Math.round(cm / 5) * 5) % 60)
    }
    setOpen(isOpen)
  }

  const handleConfirm = () => {
    onChange(
      `${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')}`,
    )
    setOpen(false)
  }

  const displayTime = `${persianDigits(h)}:${persianDigits(m)}`

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => handleOpen(true)}
        className={cn(
          'border-input bg-blush-soft dark:bg-input/30 flex h-9 touch:h-11 w-full min-w-0 items-center justify-between rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        )}
      >
        <span className="tabular-nums" dir="ltr">
          {displayTime}
        </span>
        <Clock className="h-4 w-4 opacity-50" />
      </button>

      <DrawerNested open={open} onOpenChange={handleOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label || 'انتخاب ساعت'}</DrawerTitle>
            <DrawerDescription>ساعت و دقیقه را انتخاب کنید</DrawerDescription>
          </DrawerHeader>

          <div className="flex flex-row-reverse items-center justify-center gap-2 px-8 py-4">
            <WheelColumn
              items={HOURS}
              value={tempHour}
              onChange={setTempHour}
              formatItem={(v) => persianDigits(v)}
            />

            <span className="text-3xl font-bold text-muted-foreground pb-1">
              :
            </span>

            <WheelColumn
              items={MINUTES}
              value={tempMinute}
              onChange={setTempMinute}
              formatItem={(v) => persianDigits(v)}
            />
          </div>

          <DrawerFooter>
            <Button onClick={handleConfirm} className="touch-manipulation">
              تایید
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </DrawerNested>
    </>
  )
}
