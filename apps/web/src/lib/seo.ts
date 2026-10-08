import type { BlogArticle } from './public-content'
import type { ProductGuide } from './public-content'
import { brand, titleWithBrand } from '@repo/brand'
import { presenceSameAs } from '@repo/salon-core/presence-links'
import type { Service } from '@repo/salon-core/types'
import {
  isWorkingDayOpen,
  WORKING_DAY_PILLS,
} from '@repo/salon-core/working-days'
import type { PublicSalonView } from './public-api'

// Owner-confirmed internal Salons, 2026-10-02. Keep this policy shared by
// page metadata and sitemap discovery; update it if these slugs change.
const internalSalonSlugs = new Set([
  'salon-a027zt',
  'salon-vubbcn',
  'salon-gzwp7u',
])

export function isSalonIndexable(slug: string): boolean {
  return !internalSalonSlugs.has(slug)
}

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
  address?: {
    '@type': 'PostalAddress'
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    addressCountry: 'IR'
  }
  sameAs?: string[]
  makesOffer?: JsonLdOffer[]
  openingHoursSpecification?: {
    '@type': 'OpeningHoursSpecification'
    dayOfWeek: string[]
    opens: string
    closes: string
  }[]
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
      // Service prices are stored and displayed in tomans; IRR denotes rials.
      price: service.price * 10,
      priceCurrency: 'IRR',
    },
  }
}

export function buildSalonJsonLd(
  view: PublicSalonView,
  pageUrl: URL,
): SalonJsonLd {
  const { salon, services, publicSettings, presence, businessHours } = view
  const image = new URL(`/og/${salon.slug}.png`, pageUrl.origin).toString()
  const sameAs = presenceSameAs(presence)
  const offers = services
    .filter((service) => service.active)
    .map(buildServiceOffer)
  const address =
    presence.address || presence.city || presence.province
      ? {
          '@type': 'PostalAddress' as const,
          ...(presence.address ? { streetAddress: presence.address } : {}),
          ...(presence.city ? { addressLocality: presence.city } : {}),
          ...(presence.province ? { addressRegion: presence.province } : {}),
          addressCountry: 'IR' as const,
        }
      : undefined
  const openDays = businessHours
    ? WORKING_DAY_PILLS.filter((day) =>
        isWorkingDayOpen(businessHours.workingDays, day.bit),
      ).map((day) => `https://schema.org/${day.schema}`)
    : []

  return {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: salon.name,
    ...(salon.phone ? { telephone: salon.phone } : {}),
    url: pageUrl.toString(),
    image,
    ...(publicSettings.bioText ? { description: publicSettings.bioText } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(offers.length > 0 ? { makesOffer: offers } : {}),
    ...(businessHours && openDays.length > 0
      ? {
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification' as const,
              dayOfWeek: openDays,
              opens: businessHours.workingStart,
              closes: businessHours.workingEnd,
            },
          ],
        }
      : {}),
  }
}

export function buildSalonCanonicalUrl(
  slug: string,
  publicOrigin: URL | string,
): URL {
  return new URL(`/salons/${slug}`, new URL(publicOrigin).origin)
}

export function buildSalonTitle(view: PublicSalonView): string {
  const locality = [
    view.presence.neighborhood,
    view.presence.city ?? view.presence.province,
  ]
    .filter((value): value is string => Boolean(value))
    .join('، ')
  return titleWithBrand(
    locality ? `${view.salon.name} در ${locality}` : view.salon.name,
  )
}

export function buildSalonDescription(view: PublicSalonView): string {
  if (view.publicSettings.bioText) return view.publicSettings.bioText

  const locality = [
    ...new Set([
      view.presence.neighborhood,
      view.presence.city,
      view.presence.province,
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .join('، ')
  // ponytail: three services keep the search snippet compact; make this
  // length-aware only if real snippets truncate useful service names.
  const services = view.services
    .filter((service) => service.active)
    .slice(0, 3)
    .map((service) => service.name)

  return [
    `خدمات ${view.salon.name}`,
    locality ? `در ${locality}` : null,
    services.length > 0 ? `شامل ${services.join('، ')}` : null,
    view.publicSettings.appointmentRequestsEnabled
      ? 'و ثبت درخواست نوبت آنلاین.'
      : 'و اطلاعات تماس سالن.',
  ]
    .filter(Boolean)
    .join(' ')
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

export interface PageMetadata {
  title: string
  description?: string
  canonical?: string
  ogImage?: string
  ogImageAlt?: string
  ogImageWidth?: number
  ogImageHeight?: number
  ogType?: 'website' | 'article'
  jsonLd?: unknown | unknown[]
  noIndex?: boolean
}

export function buildBlogCanonicalUrl(
  slug: string,
  publicOrigin: URL | string,
): URL {
  return new URL(
    `/blog/${encodeURIComponent(slug)}`,
    new URL(publicOrigin).origin,
  )
}

/** Article content, search snippets and sharing all describe the same revision. */
export function buildBlogMetadata(
  article: BlogArticle,
  publicOrigin: URL | string,
  preview = false,
) {
  return buildEditorialMetadata(article, publicOrigin, preview, 'blog')
}

export function buildGuideCanonicalUrl(
  slug: string,
  publicOrigin: URL | string,
): URL {
  return new URL(
    `/guides/${encodeURIComponent(slug)}`,
    new URL(publicOrigin).origin,
  )
}

export function buildGuideMetadata(
  guide: ProductGuide,
  publicOrigin: URL | string,
  preview = false,
) {
  return buildEditorialMetadata(guide, publicOrigin, preview, 'guides')
}

function buildEditorialMetadata(
  article: BlogArticle,
  publicOrigin: URL | string,
  preview: boolean,
  section: 'blog' | 'guides',
) {
  const canonical = (
    section === 'blog' ? buildBlogCanonicalUrl : buildGuideCanonicalUrl
  )(article.slug, publicOrigin).href
  const title = titleWithBrand(article.seo_title?.trim() || article.title)
  const description =
    article.seo_description?.trim() ||
    article.summary ||
    `${article.title}، ${section === 'guides' ? 'راهنمای استفاده از سالونا' : 'نوشته‌ای از وبلاگ سالونا درباره مدیریت سالن'}.`
  const cover = article.cover
  const image = new URL(cover?.src || '/og/landing.png', canonical).href
  return {
    title,
    description,
    canonical,
    ogType: 'article' as const,
    ogImage: image,
    ogImageAlt:
      cover?.alt ||
      (cover ? article.title : 'سالونا، نرم‌افزار مدیریت سالن زیبایی'),
    ogImageWidth: cover?.width ?? 1200,
    ogImageHeight: cover?.height ?? 630,
    noIndex: preview || article.search_excluded === true,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': section === 'blog' ? 'Article' : 'TechArticle',
      headline: article.title,
      description,
      url: canonical,
      mainEntityOfPage: canonical,
      inLanguage: 'fa-IR',
      image,
      author: article.bylines.map((name) => ({ '@type': 'Person', name })),
      publisher: {
        '@type': 'Organization',
        name: brand.name.fa,
        url: new URL('/', canonical).href,
      },
      ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      ...(article.modifiedAt ? { dateModified: article.modifiedAt } : {}),
    },
  }
}
