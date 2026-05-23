'use client'

// PROTOTYPE — shared horizontal date strip with scroll affordances.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MockDate } from '../mock'
import { toPersian } from '../mock'

type Props = {
  dates: MockDate[]
  selected: string
  onSelect: (key: string) => void
  accent: string
  /** Surface variant: light cards on tinted bg ("light") or transparent ("bare"). */
  surface?: 'light' | 'bare'
}

export function DateStrip({ dates, selected, onSelect, accent, surface = 'light' }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: true })

  function updateEdges() {
    const el = scrollerRef.current
    if (!el) return
    // RTL-safe: in modern browsers, scrollLeft is 0 at logical start.
    const sl = Math.abs(el.scrollLeft)
    const max = el.scrollWidth - el.clientWidth - 1
    setEdges({ start: sl > 4, end: sl < max })
  }

  useEffect(() => {
    updateEdges()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateEdges, { passive: true })
    window.addEventListener('resize', updateEdges)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      window.removeEventListener('resize', updateEdges)
    }
  }, [])

  function step(direction: 1 | -1) {
    const el = scrollerRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8
    // In RTL, scrollBy({ left: positive }) advances visually leftward = forward in time.
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  const selectedIdx = dates.findIndex((d) => d.key === selected)
  const currentMonth = dates[selectedIdx]?.month
  const counter = `روز ${toPersian(selectedIdx + 1)} از ${toPersian(dates.length)}`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] text-[#8b6b73]">
        <span className="font-bold text-[#7a2a40]">{currentMonth}</span>
        <span>{counter}</span>
      </div>
      <div className="relative">
        {/* fade gradients hinting more content */}
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-8 transition ${edges.start ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background:
              surface === 'bare'
                ? 'linear-gradient(to left, transparent, rgba(255,255,255,0.95))'
                : 'linear-gradient(to left, transparent, #fdf5f8)',
          }}
        />
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-8 transition ${edges.end ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background:
              surface === 'bare'
                ? 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))'
                : 'linear-gradient(to right, transparent, #fdf5f8)',
          }}
        />

        {/* arrows (hidden on small screens — touch users get the gradient hint + native scroll) */}
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!edges.start}
          aria-label="روزهای قبلی"
          className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 -translate-x-1 rounded-full bg-white p-1.5 text-[#7a2a40] shadow-md ring-1 ring-[#f3d5dd] transition disabled:opacity-0 sm:block"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!edges.end}
          aria-label="روزهای بعدی"
          className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 translate-x-1 rounded-full bg-white p-1.5 text-[#7a2a40] shadow-md ring-1 ring-[#f3d5dd] transition disabled:opacity-0 sm:block"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollerRef}
          className="scrollbar-hide -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
        >
          {dates.map((x, i) => {
            const active = x.key === selected
            const showsMonthBreak = i > 0 && dates[i - 1]!.month !== x.month
            return (
              <div key={x.key} className="flex shrink-0 snap-start items-center gap-2">
                {showsMonthBreak ? (
                  <span className="px-1 text-[10px] font-bold text-[#8b6b73]" aria-hidden>
                    {x.month}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSelect(x.key)}
                  className={`flex min-w-14 flex-col items-center rounded-xl border px-3 py-2 text-center transition ${
                    active
                      ? 'border-transparent text-white shadow-[0_8px_20px_rgba(124,28,48,0.22)]'
                      : 'border-[#f3d5dd] bg-white text-[#3f2730] hover:border-[#e8a8ba]'
                  }`}
                  style={active ? { background: accent } : undefined}
                >
                  <span className="text-[10px] opacity-80">{x.weekdayShort}</span>
                  <span className="mt-0.5 text-lg font-extrabold leading-none">{x.day}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* progress bar — reinforces "30 days" and current position */}
        <div className="mx-1 mt-2 h-0.5 rounded-full bg-[#f3d5dd]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              background: accent,
              width: `${((selectedIdx + 1) / dates.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
