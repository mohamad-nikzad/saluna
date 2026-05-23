'use client'

// PROTOTYPE Variant H — Agenda timeline. Different approach to showing days:
// instead of a horizontal date strip + separate time picker, the booking surface
// is a vertical scroll where each day is a row showing all of its available
// time chips inline. Sticky "jump-to" chips at the top (today / tomorrow /
// weekend / next week) let users skip ahead. Single combined slot pick.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Star, Phone, X, Sparkles } from 'lucide-react'
import {
  mockSalon,
  mockServices,
  mockDates,
  mockSlots,
  filterServices,
  formatPrice,
  formatDuration,
  toPersian,
  type MockService,
  type MockDate,
} from '../mock'
import { iconFor } from '../service-icons'

const CATEGORIES = ['همه', 'مو', 'ناخن', 'پوست', 'بدن'] as const

export function VariantH() {
  const accent = mockSalon.accent
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('همه')
  const [selected, setSelected] = useState<MockService | null>(null)

  const services = useMemo(() => {
    const list = cat === 'همه' ? mockServices : mockServices.filter((s) => s.category === cat)
    return filterServices(query, list)
  }, [query, cat])

  return (
    <main dir="rtl" className="min-h-dvh bg-[#fdf5f8] pb-24 text-[#3f2730]">
      <header className="px-5 pt-8 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-3xl bg-white/80 p-5 ring-1 ring-[#f3d5dd]">
          <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: `${accent}22` }}>
            <Sparkles className="h-6 w-6" style={{ color: accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold">{mockSalon.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-xs text-[#6b4955]">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {toPersian(mockSalon.rating)}
              </span>
              <a href={`tel:${mockSalon.phone}`} className="inline-flex items-center gap-1" style={{ color: accent }} dir="ltr">
                <Phone className="h-3.5 w-3.5" /> {toPersian(mockSalon.phone)}
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-5 max-w-3xl space-y-2 px-5 sm:px-8">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b6b73]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی خدمت…"
            className="w-full rounded-2xl border border-[#f3d5dd] bg-white py-3 pr-10 pl-4 text-sm outline-none focus:border-[#e8a8ba]"
          />
        </div>
        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
          {CATEGORIES.map((c) => {
            const sel = c === cat
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold ${
                  sel ? 'border-transparent text-white' : 'border-[#f3d5dd] bg-white text-[#7a2a40]'
                }`}
                style={sel ? { background: accent } : undefined}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <section className="mx-auto mt-5 max-w-3xl px-5 sm:px-8">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {services.map((s) => {
            const Icon = iconFor(s.id, s.category)
            return (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s)}
                  className="flex h-full w-full items-center gap-3 rounded-2xl bg-white p-3 text-right ring-1 ring-[#f3d5dd] hover:ring-[#e8a8ba]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#8b6b73]">{formatDuration(s.duration)}</p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {selected ? <AgendaSheet service={selected} accent={accent} onClose={() => setSelected(null)} /> : null}
    </main>
  )
}

type SlotPick = { dateKey: string; time: string }

function AgendaSheet({ service, accent, onClose }: { service: MockService; accent: string; onClose: () => void }) {
  const dates = mockDates(30)
  const [pick, setPick] = useState<SlotPick | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})

  // Precompute slots per day so the timeline is stable
  const days = useMemo(
    () =>
      dates.map((d) => ({
        date: d,
        slots: mockSlots(service.id + d.key),
      })),
    [service.id, dates],
  )

  const quickJumps: { label: string; idx: number }[] = [
    { label: 'امروز', idx: 0 },
    { label: 'فردا', idx: 1 },
    { label: 'این آخر هفته', idx: nextWeekendIdx(dates) },
    { label: 'هفته بعد', idx: 7 },
    { label: 'ماه بعد', idx: nextMonthIdx(dates) },
  ].filter((q) => q.idx >= 0 && q.idx < dates.length)

  function jumpTo(idx: number) {
    const key = dates[idx]?.key
    if (!key) return
    dayRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Track which day is currently in view, for the header label
  const [visibleKey, setVisibleKey] = useState(dates[0]?.key ?? '')
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setVisibleKey((top.target as HTMLElement).dataset.key ?? visibleKey)
      },
      { root, rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    )
    Object.values(dayRefs.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  const visibleDate = dates.find((d) => d.key === visibleKey)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:w-[640px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        {/* header */}
        <div className="relative shrink-0 border-b border-[#f3d5dd] p-5">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200 sm:hidden" />
          <button onClick={onClose} className="absolute left-3 top-3 rounded-full p-1.5 hover:bg-zinc-100" aria-label="بستن">
            <X className="h-4 w-4" />
          </button>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            {service.category}
          </p>
          <h3 className="mt-1 text-lg font-extrabold">{service.name}</h3>
          <p className="mt-0.5 text-xs text-[#8b6b73]">
            {formatDuration(service.duration)} · {formatPrice(service.price)}
          </p>
        </div>

        {/* quick jumps */}
        <div className="shrink-0 border-b border-[#f3d5dd] bg-[#fdf5f8] px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-bold text-[#7a2a40]">
              {visibleDate ? `${visibleDate.month} · ${visibleDate.weekday} ${visibleDate.day}` : ''}
            </span>
            <span className="text-[#8b6b73]">۳۰ روز آینده · پایین بکشید</span>
          </div>
          <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {quickJumps.map((q) => (
              <button
                key={q.label}
                onClick={() => jumpTo(q.idx)}
                className="shrink-0 rounded-full border border-[#f3d5dd] bg-white px-3 py-1 text-[12px] font-bold text-[#7a2a40] hover:border-[#e8a8ba]"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* agenda — vertical list of days, each with inline slots */}
        <div ref={scrollerRef} className="relative flex-1 overflow-y-auto px-5 py-2">
          {/* top fade to hint scroll content above */}
          <div className="pointer-events-none sticky top-0 -mx-5 h-3 bg-gradient-to-b from-white to-transparent" />
          <ul className="space-y-3">
            {days.map((day, idx) => (
              <li
                key={day.date.key}
                data-key={day.date.key}
                ref={(el) => {
                  dayRefs.current[day.date.key] = el
                }}
                className="rounded-2xl border border-[#f3d5dd] bg-white"
              >
                <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
                  <div className="flex w-14 flex-col items-center justify-center rounded-xl bg-[#fdf5f8] px-2 py-2 text-center">
                    <span className="text-[10px] font-bold text-[#7a2a40]">{day.date.weekdayShort}</span>
                    <span className="mt-0.5 text-xl font-extrabold leading-none" style={{ color: accent }}>
                      {day.date.day}
                    </span>
                    <span className="mt-1 text-[9px] text-[#8b6b73]">{day.date.month}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#8b6b73]">
                      {day.date.weekday}
                      {idx === 0 ? ' · امروز' : idx === 1 ? ' · فردا' : ''}
                    </p>
                    {day.slots.length === 0 ? (
                      <p className="mt-2 text-xs text-[#8b6b73]">نوبتی موجود نیست.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {day.slots.map((t) => {
                          const active = pick?.dateKey === day.date.key && pick?.time === t
                          return (
                            <button
                              key={t}
                              onClick={() => setPick({ dateKey: day.date.key, time: t })}
                              dir="ltr"
                              className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                                active ? 'border-transparent text-white' : 'border-[#f3d5dd] bg-white text-[#3f2730] hover:border-[#e8a8ba]'
                              }`}
                              style={active ? { background: accent } : undefined}
                            >
                              {toPersian(t)}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-[11px] text-[#8b6b73]">پایان ۳۰ روز</p>
        </div>

        {/* sticky footer — selection summary + form */}
        <div className="shrink-0 border-t border-[#f3d5dd] bg-white p-4">
          {pick ? (
            <p className="mb-3 text-xs">
              <span className="text-[#8b6b73]">انتخاب شما: </span>
              <span className="font-extrabold">
                {datesSummary(dates, pick)} · ساعت {toPersian(pick.time)}
              </span>
            </p>
          ) : (
            <p className="mb-3 text-xs text-[#8b6b73]">یک ساعت را از لیست بالا انتخاب کنید.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input placeholder="نام" className="min-w-0 flex-1 rounded-xl border border-[#f3d5dd] bg-white px-4 py-2.5 text-sm outline-none" />
            <input placeholder="۰۹xxxxxxxxx" dir="ltr" className="min-w-0 flex-1 rounded-xl border border-[#f3d5dd] bg-white px-4 py-2.5 text-sm outline-none" />
            <button
              disabled={!pick}
              className="rounded-xl px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              style={{ background: accent }}
            >
              ارسال
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function datesSummary(dates: MockDate[], pick: SlotPick): string {
  const d = dates.find((x) => x.key === pick.dateKey)
  return d ? `${d.weekday} ${d.day} ${d.month}` : ''
}

// First Friday (weekday index 6 in our Saturday-first scheme = جمعه)
function nextWeekendIdx(dates: MockDate[]): number {
  // Our mockDates uses dow = i % 7, Saturday-first; جمعه = index 6 in PERSIAN_WEEKDAYS_SHORT
  // We don't carry the dow number, but we can match by weekdayShort:
  return dates.findIndex((d, i) => i > 0 && d.weekdayShort === 'پ')
}

function nextMonthIdx(dates: MockDate[]): number {
  const first = dates[0]?.month
  return dates.findIndex((d) => d.month !== first)
}
