'use client'

// PROTOTYPE Variant D — Instagram-style grid. Image-forward tiles. Tap a tile to
// open a fullscreen modal that contains the entire booking flow inline.

import { useMemo, useState } from 'react'
import { X, Phone, Star, MapPin, Search } from 'lucide-react'
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

export function VariantD() {
  const accent = mockSalon.accent
  const [active, setActive] = useState<MockService | null>(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('همه')

  const services = useMemo(() => {
    const list = cat === 'همه' ? mockServices : mockServices.filter((s) => s.category === cat)
    return filterServices(query, list)
  }, [query, cat])

  return (
    <main dir="rtl" className="min-h-dvh bg-black pb-24 text-white">
      {/* Hero */}
      <div className="relative h-64 sm:h-80">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${accent}cc 0%, #000 100%)`,
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-6 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">سالن</p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{mockSalon.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                {toPersian(mockSalon.rating)} · {toPersian(mockSalon.reviewsCount)} نظر
              </span>
              <span className="inline-flex items-center gap-1 opacity-90">
                <MapPin className="h-3.5 w-3.5" /> {mockSalon.address}
              </span>
              <a href={`tel:${mockSalon.phone}`} className="inline-flex items-center gap-1 opacity-90 hover:opacity-100" dir="ltr">
                <Phone className="h-3.5 w-3.5" /> {toPersian(mockSalon.phone)}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter chips */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2 px-5 py-3 sm:px-8">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجوی خدمت…"
              className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 pr-10 pl-4 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/40"
            />
          </div>
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {CATEGORIES.map((c) => {
              const sel = c === cat
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold ${
                    sel ? 'border-transparent text-black' : 'border-white/20 text-white/80'
                  }`}
                  style={sel ? { background: 'white' } : undefined}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="mx-auto max-w-5xl px-3 py-4 sm:px-6">
        {services.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-8 text-center text-sm text-white/70 ring-1 ring-white/10">
            خدمتی پیدا نشد.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s)}
              className="group relative aspect-square overflow-hidden rounded-md text-right"
            >
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.image}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full" style={{ background: accent }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-sm font-extrabold">{s.name}</p>
                <p className="mt-0.5 text-[11px] opacity-90">{formatPrice(s.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {active ? <Modal service={active} accent={accent} onClose={() => setActive(null)} /> : null}
    </main>
  )
}

function Modal({ service, accent, onClose }: { service: MockService; accent: string; onClose: () => void }) {
  const dates = mockDates(30)
  const [d, setD] = useState(dates[0]!.key)
  const [t, setT] = useState<string | null>(null)
  const slots = mockSlots(service.id + d)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm" dir="rtl">
      <div className="mx-auto min-h-full max-w-2xl bg-white text-[#3f2730] sm:my-8 sm:rounded-3xl sm:shadow-2xl">
        <div className="relative">
          {service.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={service.image} alt="" className="h-60 w-full object-cover sm:rounded-t-3xl" />
          ) : null}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            {service.category}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">{service.name}</h2>
          <p className="mt-2 text-sm text-[#6b4955]">
            {formatDuration(service.duration)} · {formatPrice(service.price)}
          </p>
          {service.description ? (
            <p className="mt-3 text-sm leading-7 text-[#6b4955]">{service.description}</p>
          ) : null}

          <div className="mt-6">
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
                  className={`rounded-xl border py-2 text-sm font-bold ${
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
            className="mt-4 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ background: accent }}
          >
            ارسال درخواست رزرو
          </button>
        </div>
      </div>
    </div>
  )
}
