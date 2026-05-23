'use client'

// PROTOTYPE Variant G — Iconic. Uses lucide icons in tinted circles instead of
// photos. Service tiles show icon + name + duration + price.

import { useMemo, useState } from 'react'
import { Search, Phone, Star, MapPin, X } from 'lucide-react'
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
import { iconFor } from '../service-icons'
import { DateStrip } from '../components/DateStrip'

const CATEGORIES = ['همه', 'مو', 'ناخن', 'پوست', 'بدن'] as const

export function VariantG() {
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
        <div className="mx-auto max-w-3xl rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-[#f3d5dd]">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}22` }}>
              <Star className="h-7 w-7" style={{ color: accent }} />
            </div>
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
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-3xl space-y-2 px-5 sm:px-8">
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
        {services.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#8b6b73] ring-1 ring-[#f3d5dd]">
            خدمتی پیدا نشد.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {services.map((s) => {
              const Icon = iconFor(s.id, s.category)
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s)}
                    className="flex h-full w-full flex-col items-start gap-3 rounded-2xl bg-white p-4 text-right ring-1 ring-[#f3d5dd] transition hover:ring-[#e8a8ba] active:scale-[0.98]"
                  >
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${accent}1a`, color: accent }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                        {s.category}
                      </p>
                      <p className="mt-1 text-sm font-extrabold leading-5">{s.name}</p>
                      <p className="mt-2 text-[11px] text-[#8b6b73]">
                        {formatDuration(s.duration)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold">{formatPrice(s.price)}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {selected ? (
        <BookingSheet service={selected} accent={accent} onClose={() => setSelected(null)} />
      ) : null}
    </main>
  )
}

function BookingSheet({ service, accent, onClose }: { service: MockService; accent: string; onClose: () => void }) {
  const dates = mockDates(30)
  const [d, setD] = useState(dates[0]!.key)
  const [t, setT] = useState<string | null>(null)
  const slots = mockSlots(service.id + d)
  const Icon = iconFor(service.id, service.category)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl" dir="rtl">
        <div className="relative mb-3">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200 sm:hidden" />
          <button onClick={onClose} className="absolute left-0 top-0 rounded-full p-1.5 hover:bg-zinc-100" aria-label="بستن">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}1a`, color: accent }}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
              {service.category}
            </p>
            <h3 className="text-lg font-extrabold leading-tight">{service.name}</h3>
            <p className="mt-0.5 text-xs text-[#8b6b73]">
              {formatDuration(service.duration)} · {formatPrice(service.price)}
            </p>
          </div>
        </div>
        {service.description ? (
          <p className="mt-3 text-xs leading-6 text-[#6b4955]">{service.description}</p>
        ) : null}

        <div className="mt-5">
          <DateStrip
            dates={dates}
            selected={d}
            onSelect={(k) => {
              setD(k)
              setT(null)
            }}
            accent={accent}
            surface="bare"
          />
        </div>

        <p className="mt-4 mb-2 text-xs font-bold text-[#7a2a40]">ساعت</p>
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s) => {
            const active = s === t
            return (
              <button
                key={s}
                onClick={() => setT(s)}
                dir="ltr"
                className={`rounded-lg border py-2 text-sm font-bold ${
                  active ? 'border-transparent text-white' : 'border-[#f3d5dd] bg-white'
                }`}
                style={active ? { background: accent } : undefined}
              >
                {toPersian(s)}
              </button>
            )
          })}
        </div>

        <div className="mt-4 space-y-2">
          <input placeholder="نام و نام خانوادگی" className="w-full rounded-xl border border-[#f3d5dd] bg-white px-4 py-2.5 text-sm outline-none" />
          <input placeholder="۰۹xxxxxxxxx" dir="ltr" className="w-full rounded-xl border border-[#f3d5dd] bg-white px-4 py-2.5 text-sm outline-none" />
        </div>
        <button disabled={!t} className="mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50" style={{ background: accent }}>
          ارسال درخواست رزرو
        </button>
      </div>
    </>
  )
}
