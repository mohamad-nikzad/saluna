'use client'

// PROTOTYPE Variant B — Split panel. Services list on the right (RTL = visually
// right), sticky booking panel on the left on desktop, bottom sheet on mobile.

import { useMemo, useState } from 'react'
import { Phone, Star, X, Search } from 'lucide-react'
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

export function VariantB() {
  const accent = mockSalon.accent
  const [selected, setSelected] = useState<MockService | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('همه')

  const services = useMemo(() => {
    const list = cat === 'همه' ? mockServices : mockServices.filter((s) => s.category === cat)
    return filterServices(query, list)
  }, [query, cat])

  function pick(s: MockService) {
    setSelected(s)
    setSheetOpen(true)
  }

  return (
    <main
      dir="rtl"
      className="min-h-dvh bg-gradient-to-b from-[#fdf5f8] to-white pb-24 text-[#3f2730]"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 pt-8 lg:grid-cols-[1fr_380px] lg:px-8">
        <section className="min-w-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl ring-1 ring-[#f3d5dd]" style={{ background: accent, opacity: 0.18 }} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold sm:text-2xl">{mockSalon.name}</h1>
              <div className="mt-1 flex items-center gap-3 text-xs text-[#6b4955]">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {toPersian(mockSalon.rating)}
                </span>
                <a href={`tel:${mockSalon.phone}`} className="inline-flex items-center gap-1" dir="ltr" style={{ color: accent }}>
                  <Phone className="h-3.5 w-3.5" /> {toPersian(mockSalon.phone)}
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b6b73]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی خدمت یا دسته…"
                className="w-full rounded-2xl border border-[#f3d5dd] bg-white py-3 pr-10 pl-4 text-sm outline-none focus:border-[#e8a8ba]"
              />
            </div>
            <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
              {CATEGORIES.map((c) => {
                const active = c === cat
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold ${
                      active ? 'border-transparent text-white' : 'border-[#f3d5dd] bg-white text-[#7a2a40]'
                    }`}
                    style={active ? { background: accent } : undefined}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          {services.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-white p-6 text-center text-sm text-[#8b6b73] ring-1 ring-[#f3d5dd]">
              خدمتی پیدا نشد.
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.map((s) => {
              const active = selected?.id === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className={`group flex items-stretch overflow-hidden rounded-2xl text-right ring-1 transition ${
                    active ? 'ring-2' : 'bg-white ring-[#f3d5dd] hover:ring-[#e8a8ba]'
                  }`}
                  style={active ? { background: 'white', boxShadow: `inset 0 0 0 2px ${accent}` } : undefined}
                >
                  <div className="flex-1 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {s.category}
                    </p>
                    <p className="mt-1 text-sm font-extrabold">{s.name}</p>
                    <p className="mt-2 text-xs text-[#8b6b73]">
                      {formatDuration(s.duration)} · {formatPrice(s.price)}
                    </p>
                  </div>
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" className="h-auto w-24 object-cover" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        {/* Desktop sticky booking */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#f3d5dd]">
            <BookingPanel service={selected} accent={accent} />
          </div>
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition lg:hidden ${
          sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSheetOpen(false)}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl transition lg:hidden ${
          sheetOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" />
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="absolute left-4 top-4 rounded-full p-1.5 hover:bg-zinc-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <BookingPanel service={selected} accent={accent} />
      </div>
    </main>
  )
}

function BookingPanel({ service, accent }: { service: MockService | null; accent: string }) {
  const dates = mockDates(30)
  const [d, setD] = useState(dates[0]!.key)
  const [t, setT] = useState<string | null>(null)

  if (!service) {
    return (
      <div className="py-10 text-center text-sm text-[#8b6b73]">
        برای رزرو، یک خدمت را از لیست انتخاب کنید.
      </div>
    )
  }

  const slots = mockSlots(service.id + d)

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
        {service.category}
      </p>
      <h3 className="mt-1 text-lg font-extrabold">{service.name}</h3>
      <p className="mt-1 text-xs text-[#8b6b73]">
        {formatDuration(service.duration)} · {formatPrice(service.price)}
      </p>

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
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s) => {
          const active = s === t
          return (
            <button
              key={s}
              onClick={() => setT(s)}
              dir="ltr"
              className={`rounded-lg border py-1.5 text-sm font-bold ${
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
      <button
        disabled={!t}
        className="mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50"
        style={{ background: accent }}
      >
        ارسال درخواست رزرو
      </button>
    </div>
  )
}
