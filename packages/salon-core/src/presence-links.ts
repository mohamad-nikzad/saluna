import type { SalonPresenceFields } from './forms/presence'

export type PresenceLinkKind = 'map' | 'social' | 'website'

export type PresenceLink = {
  key: string
  kind: PresenceLinkKind
  label: string
  href: string
  dir?: 'ltr' | 'rtl'
}

function fullHttpsUrl(value: string | null | undefined): string | null {
  return value?.startsWith('https://') ? value : null
}

function handleUrl(
  base: string,
  value: string | null | undefined,
): string | null {
  if (!value) return null
  if (value.startsWith('https://')) return value
  if (!value.startsWith('@')) return null
  return `${base}/${value.slice(1)}`
}

function hostMatches(value: string, hosts: readonly string[]): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

function socialLabel(
  value: string | null | undefined,
  platformLabel: string,
  platformHosts: readonly string[],
): string {
  if (!value) return platformLabel
  if (value.startsWith('@')) return platformLabel
  return hostMatches(value, platformHosts) ? platformLabel : 'لینک'
}

function whatsappUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const international = digits.startsWith('0') ? `98${digits.slice(1)}` : digits
  return `https://wa.me/${international}`
}

function mapUrl(
  value: string | null | undefined,
  allowedHost: string,
): string | null {
  if (!value?.startsWith('https://')) return null
  return hostMatches(value, [allowedHost]) ? value : null
}

export function buildPresenceLinks(
  presence: SalonPresenceFields | null | undefined,
): PresenceLink[] {
  if (!presence) return []

  const links: PresenceLink[] = []
  const maps = [
    {
      key: 'map-google',
      label: 'گوگل مپ',
      href: mapUrl(presence.mapGoogle, 'maps.app.goo.gl'),
    },
    {
      key: 'map-neshan',
      label: 'نشان',
      href: mapUrl(presence.mapNeshan, 'neshan.org'),
    },
    {
      key: 'map-balad',
      label: 'بلد',
      href: mapUrl(presence.mapBalad, 'balad.ir'),
    },
  ]
  for (const map of maps) {
    if (map.href) links.push({ ...map, kind: 'map', href: map.href })
  }

  const instagram = handleUrl(
    'https://www.instagram.com',
    presence.socialInstagram,
  )
  if (instagram) {
    links.push({
      key: 'instagram',
      kind: 'social',
      label: socialLabel(presence.socialInstagram, 'اینستاگرام', [
        'instagram.com',
      ]),
      href: instagram,
    })
  }

  const telegram = handleUrl('https://t.me', presence.socialTelegram)
  if (telegram) {
    links.push({
      key: 'telegram',
      kind: 'social',
      label: socialLabel(presence.socialTelegram, 'تلگرام', [
        't.me',
        'telegram.me',
      ]),
      href: telegram,
    })
  }

  const whatsapp = whatsappUrl(presence.socialWhatsapp)
  if (whatsapp) {
    links.push({
      key: 'whatsapp',
      kind: 'social',
      label: 'واتساپ',
      href: whatsapp,
      dir: 'ltr',
    })
  }

  const website = fullHttpsUrl(presence.website)
  if (website) {
    links.push({
      key: 'website',
      kind: 'website',
      label: 'وب‌سایت',
      href: website,
    })
  }

  return links
}

export function presenceSameAs(
  presence: SalonPresenceFields | null | undefined,
): string[] {
  return buildPresenceLinks(presence)
    .filter((link) => link.kind === 'social' || link.kind === 'website')
    .map((link) => link.href)
}
