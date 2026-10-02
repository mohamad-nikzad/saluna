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
