import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it } from 'vitest'
import Base from '../layouts/Base.astro'

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
})
