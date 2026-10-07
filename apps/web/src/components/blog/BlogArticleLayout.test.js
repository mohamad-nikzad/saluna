import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it } from 'vitest'
import BlogArticleLayout from '../../layouts/BlogArticleLayout.astro'

const article = {
  id: 'article-1',
  slug: 'commission-basics',
  title: 'محاسبه سهم همکاران',
  summary: 'یک مثال از تقسیم مبلغ خدمت',
  bylines: ['تیم سالونا'],
  publishedAt: '2026-10-06T09:00:00.000Z',
  modifiedAt: '2026-10-07T09:00:00.000Z',
}

async function render(overrides = {}, preview = false) {
  return (await AstroContainer.create()).renderToString(BlogArticleLayout, {
    props: {
      article: { ...article, ...overrides },
      publicOrigin: 'https://saluna.test/path?ignored=true',
      preview,
    },
    request: new Request('https://saluna.test/blog/commission-basics'),
  })
}
function structuredData(html) {
  return JSON.parse(
    html.match(
      /<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/s,
    )[1],
  )
}

describe('rendered Blog Article metadata', () => {
  it('shares one canonical, article schema, public credit and branded fallback across the layout', async () => {
    const html = await render()
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html).toContain('href="https://saluna.test/blog/commission-basics"')
    expect(html).toContain('property="og:type" content="article"')
    expect(html).toContain(
      'property="og:image" content="https://saluna.test/og/landing.png"',
    )
    expect(html).toContain(
      'name="twitter:image" content="https://saluna.test/og/landing.png"',
    )
    expect(html).toContain('datetime="2026-10-06T09:00:00.000Z"')
    expect(html).not.toContain('content="noindex')
    expect(structuredData(html)).toMatchObject({
      '@type': 'Article',
      headline: 'محاسبه سهم همکاران',
      description: 'یک مثال از تقسیم مبلغ خدمت',
      datePublished: '2026-10-06T09:00:00.000Z',
      dateModified: '2026-10-07T09:00:00.000Z',
      author: [{ '@type': 'Person', name: 'تیم سالونا' }],
      publisher: { '@type': 'Organization', name: 'سالونا' },
    })
  })

  it('renders selected named credit, revisioned search fields and the cover social image', async () => {
    const html = await render({
      bylines: ['لیلا رضایی'],
      seo_title: 'عنوان اختصاصی جستجو',
      seo_description: 'توضیح اختصاصی جستجو',
      cover: {
        id: 'cover-1',
        src: 'https://saluna.test/cover.png',
        width: 640,
        height: 480,
        alt: 'تصویر مثال کمیسیون',
      },
    })
    expect(html).toContain('<title>عنوان اختصاصی جستجو')
    expect(html).toContain('name="description" content="توضیح اختصاصی جستجو"')
    expect(html).toContain(
      'property="og:description" content="توضیح اختصاصی جستجو"',
    )
    expect(html).toContain(
      'property="og:image" content="https://saluna.test/cover.png"',
    )
    expect(html).toContain('property="og:image:width" content="640"')
    expect(html).toContain(
      'name="twitter:image:alt" content="تصویر مثال کمیسیون"',
    )
    expect(structuredData(html).author).toEqual([
      { '@type': 'Person', name: 'لیلا رضایی' },
    ])
    expect(structuredData(html).image).toBe('https://saluna.test/cover.png')
  })

  it('keeps previews unindexable with a canonical URL containing no private token', async () => {
    const html = await render({ slug: 'نشانی مقاله' }, true)
    expect(html).toContain('name="robots" content="noindex, nofollow"')
    expect(html).toContain('پیش‌نمایش پیش‌نویس')
    expect(html).not.toContain('_preview=')
    expect(new URL(structuredData(html).url).pathname).toBe(
      '/blog/%D9%86%D8%B4%D8%A7%D9%86%DB%8C%20%D9%85%D9%82%D8%A7%D9%84%D9%87',
    )
  })
})
