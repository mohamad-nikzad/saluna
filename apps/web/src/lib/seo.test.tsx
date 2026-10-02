import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resolvePublicTheme } from '@repo/salon-core/public-themes'
import type { PublicSalonView } from './public-api'
import {
  buildSalonCanonicalUrl,
  buildSalonDescription,
  buildSalonJsonLd,
  buildSalonTitle,
} from './seo'
import { SalonInfoCard } from '../components/react/SalonInfoCard'
import { InlineLayout } from '../components/react/InlineLayout'
import { AgendaLayout } from '../components/react/AgendaLayout'
import { formatPrice } from './format'

const completeView: PublicSalonView = {
  salon: {
    id: 'salon-1',
    slug: 'rose-salon',
    name: 'سالن رز',
    phone: '02112345678',
    timezone: 'Asia/Tehran',
    locale: 'fa-IR',
  },
  publicSettings: {
    enabled: true,
    bioText: 'زیبایی با آرامش و دقت',
    themeId: 'rose',
    layoutId: 'agenda',
    appointmentRequestsEnabled: true,
  },
  presence: {
    province: 'تهران',
    city: 'تهران',
    neighborhood: 'سعادت‌آباد',
    address: 'خیابان سرو غربی، پلاک ۱۰',
    mapGoogle: null,
    mapNeshan: null,
    mapBalad: null,
    socialInstagram: '@rose',
    socialTelegram: null,
    socialWhatsapp: null,
    website: 'https://rose.example',
  },
  businessHours: {
    workingStart: '09:00',
    workingEnd: '19:00',
    workingDays: 63,
  },
  services: [
    {
      id: 'service-1',
      name: 'کاشت ناخن',
      category: 'nails',
      categoryId: 'category-1',
      familyId: null,
      duration: 90,
      price: 2_000_000,
      color: 'rose',
      active: true,
      kind: 'standard',
      description: 'کاشت حرفه‌ای',
    },
  ],
}

const incompleteView: PublicSalonView = {
  ...completeView,
  salon: { ...completeView.salon, phone: null },
  publicSettings: { ...completeView.publicSettings, bioText: null },
  presence: Object.fromEntries(
    Object.keys(completeView.presence).map((key) => [key, null]),
  ) as PublicSalonView['presence'],
  businessHours: null,
  services: [],
}

describe('public Salon page output', () => {
  it('renders complete location and Salon hours as visible content', () => {
    const html = renderToStaticMarkup(
      <SalonInfoCard
        name={completeView.salon.name}
        phone={completeView.salon.phone}
        bio={completeView.publicSettings.bioText}
        theme={resolvePublicTheme('rose')}
        presence={completeView.presence}
        businessHours={completeView.businessHours}
      />,
    )

    expect(html).toContain('استان تهران، شهر تهران، محله سعادت‌آباد')
    expect(html).toContain('نشانی: خیابان سرو غربی، پلاک ۱۰')
    expect(html).toContain('روزهای کاری: شنبه، یکشنبه')
    expect(html).toContain('ساعت ۰۹:۰۰ تا ۱۹:۰۰')
  })

  it('keeps incomplete Salon pages useful without empty detail labels', () => {
    const html = renderToStaticMarkup(
      <SalonInfoCard
        name={incompleteView.salon.name}
        theme={resolvePublicTheme('rose')}
        presence={incompleteView.presence}
        businessHours={incompleteView.businessHours}
      />,
    )

    expect(html).toContain('سالن رز')
    expect(html).not.toContain('نشانی:')
    expect(html).not.toContain('روزهای کاری:')
  })

  it('builds local metadata and complete BeautySalon structured data', () => {
    const canonical = buildSalonCanonicalUrl(
      completeView.salon.slug,
      'https://saluna.ir/ignored?campaign=1#top',
    )
    const jsonLd = buildSalonJsonLd(completeView, canonical)

    expect(canonical.toString()).toBe('https://saluna.ir/salons/rose-salon')
    expect(buildSalonTitle(completeView)).toBe(
      'سالن رز در سعادت‌آباد، تهران | سالونا',
    )
    expect(buildSalonDescription(completeView)).toBe('زیبایی با آرامش و دقت')
    expect(
      buildSalonDescription({
        ...completeView,
        publicSettings: {
          ...completeView.publicSettings,
          bioText: null,
        },
      }),
    ).toContain('خدمات سالن رز در سعادت‌آباد، تهران شامل کاشت ناخن')
    expect(jsonLd).toMatchObject({
      '@type': 'BeautySalon',
      telephone: '02112345678',
      url: 'https://saluna.ir/salons/rose-salon',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'خیابان سرو غربی، پلاک ۱۰',
        addressLocality: 'تهران',
        addressRegion: 'تهران',
        addressCountry: 'IR',
      },
      sameAs: ['https://www.instagram.com/rose', 'https://rose.example'],
      makesOffer: [
        {
          itemOffered: { name: 'کاشت ناخن' },
          priceSpecification: { price: 20_000_000, priceCurrency: 'IRR' },
        },
      ],
      openingHoursSpecification: [
        {
          dayOfWeek: [
            'https://schema.org/Saturday',
            'https://schema.org/Sunday',
            'https://schema.org/Monday',
            'https://schema.org/Tuesday',
            'https://schema.org/Wednesday',
            'https://schema.org/Thursday',
          ],
          opens: '09:00',
          closes: '19:00',
        },
      ],
    })
  })

  it('converts tomans to IRR without changing the visible or stored price', () => {
    const view = {
      ...completeView,
      services: completeView.services.map((service) => ({
        ...service,
        price: 550_000,
      })),
    }
    const schema = buildSalonJsonLd(
      view,
      new URL('https://saluna.ir/salons/rose-salon'),
    )
    expect(schema.makesOffer?.[0]?.priceSpecification).toMatchObject({
      price: 5_500_000,
      priceCurrency: 'IRR',
    })
    expect(view.services.map((service) => formatPrice(service.price))).toEqual([
      '۵۵۰,۰۰۰ تومان',
    ])
    expect(view.services.map((service) => service.price)).toEqual([550_000])
  })

  it('does not advertise online intake when a public Salon only shows its information', () => {
    const description = buildSalonDescription({
      ...completeView,
      publicSettings: {
        ...completeView.publicSettings,
        bioText: null,
        appointmentRequestsEnabled: false,
      },
    })
    expect(description).toContain('اطلاعات تماس سالن')
    expect(description).not.toContain('ثبت درخواست نوبت آنلاین')
  })

  for (const Layout of [InlineLayout, AgendaLayout]) {
    for (const bookingEnabled of [true, false]) {
      it(`${Layout.name} renders the complete public content once with intake ${bookingEnabled ? 'enabled' : 'disabled'}`, () => {
        const html = renderToStaticMarkup(
          <Layout
            slug={completeView.salon.slug}
            salonName={completeView.salon.name}
            phone={completeView.salon.phone}
            bio={completeView.publicSettings.bioText}
            presence={completeView.presence}
            businessHours={completeView.businessHours}
            services={completeView.services}
            dates={['2026-10-02']}
            theme={resolvePublicTheme('rose')}
            bookingEnabled={bookingEnabled}
          />,
        )
        expect(html.match(/<h1\b/g)).toHaveLength(1)
        expect(html.match(/کاشت ناخن/g)).toHaveLength(1)
        expect(html).toContain('کاشت حرفه‌ای')
        expect(html).toContain('۲,۰۰۰,۰۰۰ تومان')
        expect(html).toContain('نشانی: خیابان سرو غربی، پلاک ۱۰')
      })
    }
  }

  it('omits absent optional BeautySalon properties', () => {
    const jsonLd = buildSalonJsonLd(
      incompleteView,
      new URL('https://saluna.ir/salons/rose-salon'),
    )

    expect(jsonLd).not.toHaveProperty('telephone')
    expect(jsonLd).not.toHaveProperty('description')
    expect(jsonLd).not.toHaveProperty('address')
    expect(jsonLd).not.toHaveProperty('sameAs')
    expect(jsonLd).not.toHaveProperty('makesOffer')
    expect(jsonLd).not.toHaveProperty('openingHoursSpecification')
  })
})
