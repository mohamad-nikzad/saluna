import { describe, expect, it } from 'vitest'

import { buildPresenceLinks, presenceSameAs } from './presence-links'

describe('buildPresenceLinks', () => {
  it('builds map, handle, whatsapp, and website links in one canonical order', () => {
    expect(
      buildPresenceLinks({
        address: 'خیابان ولیعصر',
        mapGoogle: 'https://maps.app.goo.gl/abc',
        mapNeshan: 'https://neshan.org/maps/places/abc',
        mapBalad: null,
        socialInstagram: '@rose_salon',
        socialTelegram: '@rose_salon',
        socialWhatsapp: '09123456789',
        website: 'https://example.com',
      }),
    ).toEqual([
      {
        key: 'map-google',
        kind: 'map',
        label: 'گوگل مپ',
        href: 'https://maps.app.goo.gl/abc',
      },
      {
        key: 'map-neshan',
        kind: 'map',
        label: 'نشان',
        href: 'https://neshan.org/maps/places/abc',
      },
      {
        key: 'instagram',
        kind: 'social',
        label: 'اینستاگرام',
        href: 'https://www.instagram.com/rose_salon',
      },
      {
        key: 'telegram',
        kind: 'social',
        label: 'تلگرام',
        href: 'https://t.me/rose_salon',
      },
      {
        key: 'whatsapp',
        kind: 'social',
        label: 'واتساپ',
        href: 'https://wa.me/989123456789',
        dir: 'ltr',
      },
      {
        key: 'website',
        kind: 'website',
        label: 'وب‌سایت',
        href: 'https://example.com',
      },
    ])
  })

  it('uses neutral labels for arbitrary social HTTPS URLs', () => {
    expect(
      buildPresenceLinks({
        socialInstagram: 'https://example.com/rose',
        socialTelegram: 'https://telegram.me/rose',
      }).filter((link) => link.kind === 'social'),
    ).toEqual([
      {
        key: 'instagram',
        kind: 'social',
        label: 'لینک',
        href: 'https://example.com/rose',
      },
      {
        key: 'telegram',
        kind: 'social',
        label: 'تلگرام',
        href: 'https://telegram.me/rose',
      },
    ])
  })

  it('drops legacy map URLs outside the allowed providers', () => {
    expect(
      buildPresenceLinks({
        mapGoogle: 'https://example.com/maps',
        mapNeshan: 'http://neshan.org/maps/places/abc',
        mapBalad: 'https://balad.ir/p/abc',
      }).filter((link) => link.kind === 'map'),
    ).toEqual([
      {
        key: 'map-balad',
        kind: 'map',
        label: 'بلد',
        href: 'https://balad.ir/p/abc',
      },
    ])
  })
})

describe('presenceSameAs', () => {
  it('keeps every canonical social and website URL aligned with rendered links', () => {
    expect(
      presenceSameAs({
        mapGoogle: 'https://maps.app.goo.gl/abc',
        socialInstagram: '@rose_salon',
        socialWhatsapp: '09123456789',
        website: 'https://example.com',
      }),
    ).toEqual([
      'https://www.instagram.com/rose_salon',
      'https://wa.me/989123456789',
      'https://example.com',
    ])
  })
})
