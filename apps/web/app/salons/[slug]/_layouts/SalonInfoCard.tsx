import { MapPin, Phone } from 'lucide-react'
import type { PublicTheme } from '@repo/salon-core/public-themes'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

function monogramFor(name: string): string {
  return Array.from(name.trim())[0] ?? '?'
}

export type SalonInfoCardProps = {
  name: string
  phone?: string | null
  bio?: string | null
  theme: PublicTheme
  /** Reserved for future fields — render only when present. */
  address?: string | null
  mapUrl?: string | null
  compact?: boolean
}

/**
 * Unified salon identity card shared by every public layout. Renders a banner +
 * floating card with monogram, name, phone, and bio. Optional fields (address,
 * map link) appear only when provided, leaving room to grow without restyling.
 */
export function SalonInfoCard({
  name,
  phone,
  bio,
  theme,
  address,
  mapUrl,
  compact = false,
}: SalonInfoCardProps) {
  return (
    <header className="relative isolate">
      <div
        className={compact ? 'h-20 w-full sm:h-24' : 'h-32 w-full sm:h-40'}
        style={{ background: theme.swatch }}
      />
      <div className="mx-auto -mt-12 w-full max-w-3xl px-5 sm:px-8">
        <div
          className="rounded-3xl border bg-white/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur sm:p-6"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-4 bg-white text-2xl font-extrabold shadow sm:h-20 sm:w-20 sm:text-3xl"
              style={{ borderColor: theme.bg, color: theme.primary }}
            >
              {monogramFor(name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold sm:text-2xl">{name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                    style={{ color: theme.primary }}
                    dir="ltr"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {toPersianDigits(phone)}
                  </a>
                ) : null}
                {address ? (
                  mapUrl ? (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 opacity-80 hover:underline"
                    >
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      {address}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 opacity-80">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      {address}
                    </span>
                  )
                ) : null}
              </div>
            </div>
          </div>
          {bio ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-7 opacity-80">
              {bio}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
