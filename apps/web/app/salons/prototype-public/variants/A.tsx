'use client'

// PROTOTYPE Variant A — Inline expand. Single scroll page; tap a service to
// expand inline booking (date + time + form). No navigation.

import { useMemo, useState } from 'react'
import { Phone, Star, MapPin, Clock, ChevronDown, Search, X } from 'lucide-react'
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
} from '../mock'
import { DateStrip } from '../components/DateStrip'

export function VariantA() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const accent = mockSalon.accent

  const filtered = useMemo(() => filterServices(query), [query])
  const groups = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, MockService[]>>((acc, s) => {
          ;(acc[s.category] ??= []).push(s)
          return acc
        }, {}),
      ),
    [filtered],
  )

  return (
    <main
      dir="rtl"
      className="min-h-dvh bg-[#fdf5f8] pb-32 text-[#3f2730]"
      style={{ ['--c' as never]: accent }}
    >
      <header className="px-5 pt-8 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-[#f3d5dd]">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl" style={{ background: accent, opacity: 0.18 }} />
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold sm:text-2xl">{mockSalon.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b4955]">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {toPersian(mockSalon.rating)} ({toPersian(mockSalon.reviewsCount)})
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {mockSalon.address}
                </span>
                <a href={`tel:${mockSalon.phone}`} className="inline-flex items-center gap-1" style={{ color: accent }} dir="ltr">
                  <Phone className="h-3.5 w-3.5" /> {toPersian(mockSalon.phone)}
                </a>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-[#6b4955]">{mockSalon.bio}</p>
        </div>
      </header>

      <section className="mx-auto mt-6 max-w-3xl px-5 sm:px-8">
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b6b73]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی خدمت…"
            className="w-full rounded-2xl border border-[#f3d5dd] bg-white py-3 pr-10 pl-10 text-sm outline-none transition focus:border-[#e8a8ba]"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8b6b73] hover:bg-[#fdf5f8]"
              aria-label="پاک کردن"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#8b6b73] ring-1 ring-[#f3d5dd]">
            خدمتی پیدا نشد.
          </p>
        ) : null}

        <div className="space-y-8">
          {groups.map(([cat, list]) => (
            <div key={cat}>
              <h2 className="mb-3 text-base font-extrabold" style={{ color: accent }}>
                {cat}
              </h2>
              <ul className="space-y-3">
                {list.map((service) => {
                  const open = openId === service.id
                  return (
                    <li key={service.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#f3d5dd]">
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : service.id)}
                        className="flex w-full items-center justify-between gap-3 p-4 text-right"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-extrabold">{service.name}</p>
                          <p className="mt-1 text-xs text-[#8b6b73]">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDuration(service.duration)}
                            </span>
                            <span className="mx-2">·</span>
                            {formatPrice(service.price)}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 transition ${open ? 'rotate-180' : ''}`}
                          style={{ color: accent }}
                        />
                      </button>
                      {open ? <InlineBooking serviceId={service.id} accent={accent} /> : null}
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

function InlineBooking({ serviceId, accent }: { serviceId: string; accent: string }) {
  const dates = mockDates(30)
  const [d, setD] = useState(dates[0]!.key)
  const [t, setT] = useState<string | null>(null)
  const slots = mockSlots(serviceId + d)

  return (
    <div className="border-t border-[#f3d5dd] bg-[#fdf5f8] p-4">
      <DateStrip
        dates={dates}
        selected={d}
        onSelect={(k) => {
          setD(k)
          setT(null)
        }}
        accent={accent}
      />

      <p className="mt-4 mb-2 text-xs font-bold text-[#7a2a40]">انتخاب زمان</p>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((s) => {
          const active = s === t
          return (
            <button
              key={s}
              type="button"
              onClick={() => setT(s)}
              dir="ltr"
              className={`rounded-xl border px-2 py-2 text-center text-sm font-bold ${
                active ? 'border-transparent text-white' : 'border-[#f3d5dd] bg-white'
              }`}
              style={active ? { background: accent } : undefined}
            >
              {toPersian(s)}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          placeholder="نام و نام خانوادگی"
          className="rounded-xl border border-[#f3d5dd] bg-white px-4 py-2.5 text-sm outline-none"
        />
        <input
          placeholder="۰۹xxxxxxxxx"
          dir="ltr"
          className="rounded-xl border border-[#f3d5dd] bg-white px-4 py-2.5 text-sm outline-none"
        />
      </div>
      <button
        type="button"
        disabled={!t}
        className="mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50"
        style={{ background: accent }}
      >
        ارسال درخواست رزرو
      </button>
    </div>
  )
}
