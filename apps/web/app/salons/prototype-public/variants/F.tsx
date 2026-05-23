'use client'

// PROTOTYPE Variant F — Minimal mobile grid. Just service titles, dense 2-col
// grid optimized for mobile. No time, no price on the tile. Search + chips up
// top. Tap → bottom-sheet booking that reveals the details.

import { useMemo, useState } from 'react'
import { Search, X, Star, Phone } from 'lucide-react'
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

const CATEGORIES = ['همه', 'مو', 'ناخن', 'پوست', 'بدن'] as const

export function VariantF() {
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
      {/* compact header */}
      <header className="px-4 pt-6">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-2xl" style={{ background: accent, opacity: 0.2 }} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-extrabold">{mockSalon.name}</h1>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[#6b4955]">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {toPersian(mockSalon.rating)}
                </span>
                <a href={`tel:${mockSalon.phone}`} dir="ltr" style={{ color: accent }} className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {toPersian(mockSalon.phone)}
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* sticky search + chips */}
      <div className="sticky top-0 z-20 mt-4 border-b border-[#f3d5dd] bg-[#fdf5f8]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b6b73]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجوی خدمت…"
              className="w-full rounded-full border border-[#f3d5dd] bg-white py-2.5 pr-10 pl-4 text-sm outline-none focus:border-[#e8a8ba]"
            />
          </div>
          <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {CATEGORIES.map((c) => {
              const sel = c === cat
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 rounded-full border px-3.5 py-1 text-[12px] font-bold transition ${
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
      </div>

      {/* dense grid — titles only */}
      <section className="mx-auto mt-4 max-w-md px-4">
        {services.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#8b6b73] ring-1 ring-[#f3d5dd]">
            خدمتی پیدا نشد.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s)}
                  className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-white px-3 text-center text-sm font-extrabold leading-6 ring-1 ring-[#f3d5dd] transition active:scale-[0.98]"
                  style={{ color: '#3f2730' }}
                >
                  <span className="line-clamp-3">{s.name}</span>
                </button>
              </li>
            ))}
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl" dir="rtl">
        <div className="relative mb-3">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" />
          <button onClick={onClose} className="absolute left-0 top-0 rounded-full p-1.5 hover:bg-zinc-100" aria-label="بستن">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
          {service.category}
        </p>
        <h3 className="mt-1 text-xl font-extrabold">{service.name}</h3>
        <p className="mt-1 text-xs text-[#8b6b73]">
          {formatDuration(service.duration)} · {formatPrice(service.price)}
        </p>
        {service.description ? (
          <p className="mt-2 text-xs leading-6 text-[#6b4955]">{service.description}</p>
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
