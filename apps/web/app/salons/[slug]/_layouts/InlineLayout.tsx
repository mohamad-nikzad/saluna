'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import type { PublicTheme } from '@repo/salon-core/public-themes'
import type { Service } from '@repo/salon-core/types'
import { serviceCategoryName } from '@repo/salon-core/service-catalog'
import { formatDuration, formatHm, formatPrice } from '../../_lib/format'
import { SalonInfoCard } from './SalonInfoCard'
import { BookingForm, type PickedSlot } from './BookingForm'
import {
  emptyReasonMessage,
  useDayAvailability,
  usePublicDates,
} from './use-public-booking'

export type PublicLayoutProps = {
  slug: string
  services: Service[]
  dates: string[]
  theme: PublicTheme
  bookingEnabled: boolean
  salonName: string
  phone: string | null
  bio: string | null
}

export function InlineLayout(props: PublicLayoutProps) {
  const { slug, services, dates, theme, bookingEnabled, salonName, phone, bio } =
    props
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const q = query.trim()
    const filtered = q
      ? services.filter(
          (s) => s.name.includes(q) || serviceCategoryName(s).includes(q),
        )
      : services
    const map = new Map<string, { label: string; items: Service[] }>()
    for (const s of filtered) {
      const key = s.categoryId ?? s.category
      const label = serviceCategoryName(s)
      if (!map.has(key)) map.set(key, { label, items: [] })
      map.get(key)!.items.push(s)
    }
    return [...map.values()]
  }, [services, query])

  return (
    <main
      dir="rtl"
      className="min-h-dvh pb-24"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <SalonInfoCard name={salonName} phone={phone} bio={bio} theme={theme} />

      <section className="mx-auto mt-6 w-full max-w-3xl px-5 sm:px-8">
        {!bookingEnabled ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            در حال حاضر امکان رزرو آنلاین در این سالن غیرفعال است. لطفاً برای
            هماهنگی نوبت با سالن تماس بگیرید.
          </div>
        ) : null}

        <div className="relative mb-6">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی خدمت…"
            className="w-full rounded-2xl border border-black/10 bg-white py-3 pr-10 pl-10 text-sm outline-none transition focus:border-black/25"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-60 hover:bg-black/5"
              aria-label="پاک کردن"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <p className="rounded-2xl bg-white/85 p-6 text-center text-sm opacity-70">
            خدمتی پیدا نشد.
          </p>
        ) : null}

        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label}>
              <h2
                className="mb-3 text-base font-extrabold"
                style={{ color: theme.primary }}
              >
                {group.label}
              </h2>
              <ul className="space-y-3">
                {group.items.map((service) => {
                  const open = openId === service.id
                  return (
                    <li
                      key={service.id}
                      className="overflow-hidden rounded-2xl bg-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          bookingEnabled
                            ? setOpenId(open ? null : service.id)
                            : undefined
                        }
                        className="flex w-full items-center justify-between gap-3 p-4 text-right"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-extrabold">
                            {service.name}
                          </p>
                          <p className="mt-1 text-xs opacity-70">
                            {formatDuration(service.duration)} ·{' '}
                            {formatPrice(service.price)}
                          </p>
                        </div>
                        {bookingEnabled ? (
                          <ChevronDown
                            className={`h-5 w-5 shrink-0 transition ${open ? 'rotate-180' : ''}`}
                            style={{ color: theme.primary }}
                          />
                        ) : null}
                      </button>
                      {open ? (
                        <InlineBooking
                          slug={slug}
                          service={service}
                          dates={dates}
                          theme={theme}
                        />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function InlineBooking({
  slug,
  service,
  dates,
  theme,
}: {
  slug: string
  service: Service
  dates: string[]
  theme: PublicTheme
}) {
  const items = usePublicDates(dates)
  const [selectedDate, setSelectedDate] = useState(items[0]?.ymd ?? '')
  const [selectedStart, setSelectedStart] = useState<string | null>(null)
  const { slots, loading, error, emptyReason } = useDayAvailability(
    slug,
    service.id,
    selectedDate,
    true,
  )

  const picked: PickedSlot | null = selectedStart
    ? { date: selectedDate, startTime: selectedStart }
    : null

  return (
    <div className="border-t border-black/5 bg-black/[0.02] p-4">
      <p className="mb-2 text-xs font-bold" style={{ color: theme.primary }}>
        انتخاب روز
      </p>
      <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {items.map((item) => {
          const active = item.ymd === selectedDate
          return (
            <button
              key={item.ymd}
              type="button"
              onClick={() => {
                setSelectedDate(item.ymd)
                setSelectedStart(null)
              }}
              className={`flex min-w-16 flex-col items-center rounded-xl border px-3 py-2 text-center transition ${
                active ? 'border-transparent text-white' : 'border-black/10 bg-white'
              }`}
              style={active ? { backgroundColor: theme.primary } : undefined}
            >
              <span className="text-[10px] opacity-80">{item.weekday}</span>
              <span className="mt-1 text-lg font-extrabold leading-none">
                {item.day}
              </span>
              <span className="mt-1 text-[10px] opacity-80">{item.month}</span>
            </button>
          )
        })}
      </div>

      <p className="mb-2 mt-4 text-xs font-bold" style={{ color: theme.primary }}>
        انتخاب زمان
      </p>
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white p-3 text-sm opacity-70">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          در حال بارگذاری زمان‌های موجود…
        </div>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : slots.length === 0 ? (
        <p className="rounded-xl border border-black/10 bg-white p-3 text-sm opacity-70">
          {emptyReasonMessage(emptyReason)}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((slot) => {
            const active = slot.startTime === selectedStart
            return (
              <button
                key={slot.startTime}
                type="button"
                onClick={() => setSelectedStart(slot.startTime)}
                dir="ltr"
                className={`rounded-xl border px-2 py-2 text-center text-sm font-bold transition ${
                  active ? 'border-transparent text-white' : 'border-black/10 bg-white'
                }`}
                style={active ? { backgroundColor: theme.primary } : undefined}
              >
                {formatHm(slot.startTime)}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <BookingForm
          slug={slug}
          service={service}
          picked={picked}
          theme={theme}
          variant="stacked"
        />
      </div>
    </div>
  )
}
