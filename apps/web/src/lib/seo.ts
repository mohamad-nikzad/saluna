import { brand } from '@repo/brand'
import { presenceSameAs } from '@repo/salon-core/presence-links'
import type { Service } from '@repo/salon-core/types'
import type { PublicSalonView } from './public-api'

type JsonLdOffer = {
  '@type': 'Offer'
  itemOffered: {
    '@type': 'Service'
    name: string
    description?: string
    duration?: string
  }
  priceSpecification: {
    '@type': 'UnitPriceSpecification'
    price: number
    priceCurrency: 'IRR'
  }
}

type SalonJsonLd = {
  '@context': 'https://schema.org'
  '@type': 'BeautySalon'
  name: string
  telephone?: string
  url: string
  image: string
  description?: string
  address?: string
  sameAs?: string[]
  makesOffer: JsonLdOffer[]
}

function isoDurationMinutes(minutes: number): string {
  return `PT${minutes}M`
}

function buildServiceOffer(service: Service): JsonLdOffer {
  return {
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      name: service.name,
      ...(service.description ? { description: service.description } : {}),
      duration: isoDurationMinutes(service.duration),
    },
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: service.price,
      priceCurrency: 'IRR',
    },
  }
}

export function buildSalonJsonLd(
  view: PublicSalonView,
  pageUrl: URL,
): SalonJsonLd {
  const { salon, services, publicSettings, presence } = view
  const image = new URL(`/og/${salon.slug}.png`, pageUrl.origin).toString()
  const sameAs = presenceSameAs(presence)

  return {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: salon.name,
    ...(salon.phone ? { telephone: salon.phone } : {}),
    url: pageUrl.toString(),
    image,
    ...(publicSettings.bioText ? { description: publicSettings.bioText } : {}),
    ...(presence.address ? { address: presence.address } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    makesOffer: services.filter((s) => s.active).map(buildServiceOffer),
  }
}

export type BreadcrumbJsonLd = {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: {
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }[]
}

export function buildSalonBreadcrumbJsonLd(
  salonName: string,
  pageUrl: URL,
): BreadcrumbJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: brand.name.fa,
        item: new URL('/', pageUrl.origin).toString(),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: salonName,
        item: pageUrl.toString(),
      },
    ],
  }
}
