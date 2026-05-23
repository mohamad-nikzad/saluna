'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import type { PublicTheme } from '@repo/salon-core/public-themes'
import type { Service } from '@repo/salon-core/types'
import { serviceCategoryName } from '@repo/salon-core/service-catalog'
import { formatDuration, formatHm, formatPrice } from '../../_lib/format'
import { SalonInfoCard } from './SalonInfoCard'
import { BookingForm, type PickedSlot } from './BookingForm'
import { iconForService } from './service-icons'
import {
  emptyReasonMessage,
  toPublicDates,
  useDayAvailability,
  type PublicDate,
} from './use-public-booking'
import type { PublicLayoutProps } from './InlineLayout'

const ALL = 'همه'

export function AgendaLayout(props: PublicLayoutProps) {
  const { slug, services, dates, theme, bookingEnabled, salonName, phone, bio } =
    props
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>(ALL)
  const [selected, setSelected] = useState<Service | null>(null)

  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = [ALL]
    for (const s of services) {
      const name = serviceCategoryName(s)
      if (!seen.has(name)) {
        seen.add(name)
        out.push(name)
      }
    }
    return out
  }, [services])

  const filtered = useMemo(() => {
    const q = query.trim()
    return services.filter((s) => {
      if (cat !== ALL && serviceCategoryName(s) !== cat) return false
      if (q && !s.name.includes(q) && !serviceCategoryName(s).includes(q))
        return false
      return true
    })
  }, [services, query, cat])

  return (
    <main
      dir="rtl"
      className="min-h-dvh pb-24"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <SalonInfoCard name={salonName} phone={phone} bio={bio} theme={theme} />

      <div className="mx-auto mt-5 w-full max-w-3xl space-y-3 px-5 sm:px-8">
        {!bookingEnabled ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            در حال حاضر امکان رزرو آنلاین در این سالن غیرفعال است. لطفاً برای
            هماهنگی نوبت با سالن تماس بگیرید.
          </div>
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی خدمت…"
            className="w-full rounded-2xl border border-black/10 bg-white py-3 pr-10 pl-4 text-sm outline-none transition focus:border-black/25"
          />
        </div>

        {categories.length > 2 ? (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
            {categories.map((c) => {
              const sel = c === cat
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                    sel ? 'border-transparent text-white' : 'border-black/10 bg-white'
                  }`}
                  style={sel ? { backgroundColor: theme.primary } : undefined}
                >
                  {c}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <section className="mx-auto mt-5 w-full max-w-3xl px-5 sm:px-8">
        {filtered.length === 0 ? (
          <p className="rounded-2xl bg-white/85 p-6 text-center text-sm opacity-70">
            خدمتی پیدا نشد.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((s) => {
              const Icon = iconForService(s)
              return (
                <li key={s.id}>
                  <button
                    onClick={() => (bookingEnabled ? setSelected(s) : undefined)}
                    className="flex h-full w-full items-center gap-3 rounded-2xl bg-white/85 p-3 text-right shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition hover:shadow-md"
                  >
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${theme.primary}1a`, color: theme.primary }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{s.name}</p>
                      <p className="mt-0.5 text-[11px] opacity-60">
                        {formatDuration(s.duration)}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {selected ? (
        <AgendaSheet
          slug={slug}
          service={selected}
          dates={dates}
          theme={theme}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </main>
  )
}

function AgendaSheet({
  slug,
  service,
  dates,
  theme,
  onClose,
}: {
  slug: string
  service: Service
  dates: string[]
  theme: PublicTheme
  onClose: () => void
}) {
  const items = useMemo(() => toPublicDates(dates), [dates])
  const [pick, setPick] = useState<PickedSlot | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dayRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [activeKeys, setActiveKeys] = useState<Set<string>>(
    () => new Set(items.slice(0, 3).map((d) => d.ymd)),
  )
  const [visibleKey, setVisibleKey] = useState(items[0]?.ymd ?? '')

  const quickJumps = useMemo(() => {
    const firstMonth = items[0]?.jm
    return [
      { label: 'امروز', ymd: items[0]?.ymd },
      { label: 'فردا', ymd: items[1]?.ymd },
      {
        label: 'این آخر هفته',
        ymd: items.find((d, i) => i > 0 && d.weekdayShort === 'ج')?.ymd,
      },
      { label: 'هفته بعد', ymd: items[7]?.ymd },
      { label: 'ماه بعد', ymd: items.find((d) => d.jm !== firstMonth)?.ymd },
    ].filter((q): q is { label: string; ymd: string } => Boolean(q.ymd))
  }, [items])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const els = [...dayRefs.current.values()]

    const activation = new IntersectionObserver(
      (entries) => {
        const newly = entries
          .filter((e) => e.isIntersecting)
          .map((e) => (e.target as HTMLElement).dataset.ymd)
          .filter((k): k is string => Boolean(k))
        if (newly.length === 0) return
        setActiveKeys((prev) => {
          const next = new Set(prev)
          for (const k of newly) next.add(k)
          return next
        })
      },
      { root, rootMargin: '300px 0px', threshold: 0 },
    )

    const header = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) {
          const k = (top.target as HTMLElement).dataset.ymd
          if (k) setVisibleKey(k)
        }
      },
      { root, rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    )

    for (const el of els) {
      activation.observe(el)
      header.observe(el)
    }
    return () => {
      activation.disconnect()
      header.disconnect()
    }
  }, [items])

  function jumpTo(ymd: string) {
    dayRefs.current.get(ymd)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const visibleDate = items.find((d) => d.ymd === visibleKey)
  const pickedDate = pick ? items.find((d) => d.ymd === pick.date) : undefined

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-3xl bg-white text-[#1f1620] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:w-[640px] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
      >
        <div className="relative shrink-0 border-b border-black/10 p-5">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200 sm:hidden" />
          <button
            onClick={onClose}
            className="absolute left-3 top-3 rounded-full p-1.5 hover:bg-zinc-100"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
          <p
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: theme.primary }}
          >
            {serviceCategoryName(service)}
          </p>
          <h3 className="mt-1 text-lg font-extrabold">{service.name}</h3>
          <p className="mt-0.5 text-xs opacity-60">
            {formatDuration(service.duration)} · {formatPrice(service.price)}
          </p>
        </div>

        <div className="shrink-0 border-b border-black/10 bg-black/[0.02] px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-bold" style={{ color: theme.primary }}>
              {visibleDate
                ? `${visibleDate.month} · ${visibleDate.weekday} ${visibleDate.day}`
                : ''}
            </span>
            <span className="opacity-60">۳۰ روز آینده · پایین بکشید</span>
          </div>
          <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {quickJumps.map((q) => (
              <button
                key={q.label}
                onClick={() => jumpTo(q.ymd)}
                className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-bold hover:border-black/25"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollerRef} className="relative flex-1 overflow-y-auto px-5 py-2">
          <ul className="space-y-3">
            {items.map((date) => (
              <li
                key={date.ymd}
                data-ymd={date.ymd}
                ref={(el) => {
                  if (el) dayRefs.current.set(date.ymd, el)
                  else dayRefs.current.delete(date.ymd)
                }}
                className="rounded-2xl border border-black/10 bg-white"
              >
                <AgendaDayRow
                  slug={slug}
                  service={service}
                  date={date}
                  theme={theme}
                  active={activeKeys.has(date.ymd)}
                  pick={pick}
                  onPick={setPick}
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-[11px] opacity-60">پایان ۳۰ روز</p>
        </div>

        <div className="shrink-0 border-t border-black/10 bg-white p-4">
          {pick && pickedDate ? (
            <p className="mb-3 text-xs">
              <span className="opacity-60">انتخاب شما: </span>
              <span className="font-extrabold">
                {pickedDate.weekday} {pickedDate.day} {pickedDate.month} · ساعت{' '}
                {formatHm(pick.startTime)}
              </span>
            </p>
          ) : (
            <p className="mb-3 text-xs opacity-60">
              یک ساعت را از لیست بالا انتخاب کنید.
            </p>
          )}
          <BookingForm
            slug={slug}
            service={service}
            picked={pick}
            theme={theme}
            variant="row"
          />
        </div>
      </div>
    </>
  )
}

function AgendaDayRow({
  slug,
  service,
  date,
  theme,
  active,
  pick,
  onPick,
}: {
  slug: string
  service: Service
  date: PublicDate
  theme: PublicTheme
  active: boolean
  pick: PickedSlot | null
  onPick: (p: PickedSlot) => void
}) {
  const { slots, loading, error, emptyReason } = useDayAvailability(
    slug,
    service.id,
    date.ymd,
    active,
  )

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <div className="flex w-14 flex-col items-center justify-center rounded-xl bg-black/[0.03] px-2 py-2 text-center">
        <span className="text-[10px] font-bold opacity-70">{date.weekdayShort}</span>
        <span
          className="mt-0.5 text-xl font-extrabold leading-none"
          style={{ color: theme.primary }}
        >
          {date.day}
        </span>
        <span className="mt-1 text-[9px] opacity-50">{date.month}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] opacity-60">{date.weekday}</p>
        {!active || loading ? (
          <div className="mt-2 flex items-center gap-2 text-xs opacity-50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            در حال بارگذاری…
          </div>
        ) : error ? (
          <p className="mt-2 text-xs text-rose-600">{error}</p>
        ) : slots.length === 0 ? (
          <p className="mt-2 text-xs opacity-60">{emptyReasonMessage(emptyReason)}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {slots.map((slot) => {
              const activeSlot =
                pick?.date === date.ymd && pick?.startTime === slot.startTime
              return (
                <button
                  key={slot.startTime}
                  onClick={() => onPick({ date: date.ymd, startTime: slot.startTime })}
                  dir="ltr"
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                    activeSlot
                      ? 'border-transparent text-white'
                      : 'border-black/10 bg-white hover:border-black/25'
                  }`}
                  style={activeSlot ? { backgroundColor: theme.primary } : undefined}
                >
                  {formatHm(slot.startTime)}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
