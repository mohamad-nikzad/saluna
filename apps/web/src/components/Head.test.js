import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it } from 'vitest'
import Base from '../layouts/Base.astro'
import SalonLayout from '../layouts/SalonLayout.astro'
import { isSalonIndexable } from '../lib/seo'

describe('rendered page robots metadata', () => {
  it('renders noindex and nofollow for a private AppointmentRequest status page', async () => {
    const html = await (
      await AstroContainer.create()
    ).renderToString(Base, {
      props: { title: 'وضعیت درخواست رزرو', noIndex: true },
    })

    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
  })

  it('keeps CMS-authored closing-script text inside shared JSON-LD', async () => {
    const headline = '</script><script id="cms-injection">alert(1)</script>'
    const html = await (
      await AstroContainer.create()
    ).renderToString(Base, {
      props: { title: 'مقاله', jsonLd: { '@type': 'Article', headline } },
    })
    expect(html).not.toContain('<script id="cms-injection">')
    const blocks = [
      ...html.matchAll(
        /<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
      ),
    ]
    expect(blocks).toHaveLength(1)
    expect(JSON.parse(blocks[0][1]).headline).toBe(headline)
  })

  it('leaves public Salon metadata indexable by default', async () => {
    const html = await (
      await AstroContainer.create()
    ).renderToString(Base, {
      props: { title: 'سالن رز' },
    })

    expect(html).not.toContain('name="robots"')
  })

  it.each([
    ['salon-a027zt', true],
    ['salon-vubbcn', true],
    ['salon-gzwp7u', true],
    ['aravirabeautylounge', false],
    ['mehrnanail', false],
    ['salon-wizjyw', false],
  ])('renders the confirmed indexing policy for %s', async (slug, excluded) => {
    const html = await (
      await AstroContainer.create()
    ).renderToString(SalonLayout, {
      props: { title: 'سالن', noIndex: !isSalonIndexable(slug) },
      slots: { default: '<h1>سالن</h1>' },
    })

    expect(
      html.includes('<meta name="robots" content="noindex, nofollow">'),
    ).toBe(excluded)
    expect(html).toContain('<h1>سالن</h1>')
  })
})
