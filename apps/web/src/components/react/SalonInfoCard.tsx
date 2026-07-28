import {
  Camera,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react'
import type { PublicTheme } from '@repo/salon-core/public-themes'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { SalonPresenceFields } from '@repo/salon-core/forms/presence'
import type { PublicSalonBusinessHours } from '@repo/api-client/types'
import {
  buildPresenceLinks,
  type PresenceLink,
} from '@repo/salon-core/presence-links'
import { formatPersianTime } from '@repo/salon-core/persian-digits'
import {
  isWorkingDayOpen,
  WORKING_DAY_PILLS,
} from '@repo/salon-core/working-days'

function monogramFor(name: string): string {
  return Array.from(name.trim())[0] ?? '?'
}

export type SalonInfoCardProps = {
  name: string
  phone?: string | null
  bio?: string | null
  theme: PublicTheme
  presence: SalonPresenceFields
  businessHours?: PublicSalonBusinessHours | null
  compact?: boolean
}

function iconForLink(link: PresenceLink) {
  if (link.key === 'instagram') return Camera
  if (link.key === 'telegram') return Send
  if (link.key === 'whatsapp') return MessageCircle
  if (link.kind === 'website') return Globe
  return MapPin
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
  presence,
  businessHours,
  compact = false,
}: SalonInfoCardProps) {
  const contactLinks = buildPresenceLinks(presence)
  const locality = [
    presence.province ? `استان ${presence.province}` : null,
    presence.city ? `شهر ${presence.city}` : null,
    presence.neighborhood ? `محله ${presence.neighborhood}` : null,
  ]
    .filter(Boolean)
    .join('، ')
  const workingDays = businessHours
    ? WORKING_DAY_PILLS.filter((day) =>
        isWorkingDayOpen(businessHours.workingDays, day.bit),
      )
        .map((day) => day.fullLabel)
        .join('، ')
    : ''

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
                {locality ? (
                  <span className="inline-flex items-center gap-1.5 opacity-80">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {locality}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {presence.address ? (
            <p className="mt-4 text-sm leading-7 opacity-80">
              نشانی: {presence.address}
            </p>
          ) : null}
          {businessHours && workingDays ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm leading-7 opacity-80">
              <Clock className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                روزهای کاری: {workingDays}، ساعت{' '}
                {formatPersianTime(businessHours.workingStart)} تا{' '}
                {formatPersianTime(businessHours.workingEnd)}
              </span>
            </p>
          ) : null}
          {bio ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-7 opacity-80">
              {bio}
            </p>
          ) : null}
          {contactLinks.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {contactLinks.map((link) => {
                const Icon = iconForLink(link)
                return (
                  <a
                    key={link.key}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir={link.dir}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold transition hover:border-black/20 hover:bg-black/[0.03]"
                    style={{ color: theme.primary }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {link.key === 'whatsapp'
                      ? toPersianDigits(link.label)
                      : link.label}
                    <ExternalLink
                      className="h-3 w-3 opacity-55"
                      aria-hidden="true"
                    />
                  </a>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
