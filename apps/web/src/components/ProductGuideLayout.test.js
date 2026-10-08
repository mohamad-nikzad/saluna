import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { expect, it } from 'vitest'
import ProductGuideLayout from '../layouts/ProductGuideLayout.astro'

it('renders a maintained public guide with ordered steps and one shared metadata path', async () => {
  const html = await (
    await AstroContainer.create()
  ).renderToString(ProductGuideLayout, {
    props: {
      guide: {
        id: 'guide-1',
        slug: 'create-client',
        title: 'افزودن مشتری در سالونا',
        summary: 'نام و شماره مشتری را درست ثبت کنید.',
        bylines: ['تیم سالونا'],
        reviewed_at: '2026-10-08T09:00:00.000Z',
        reviewer_name: 'تیم محصول سالونا',
        relatedGuides: [],
        body: [
          {
            _type: 'block',
            _key: 'step-1',
            style: 'normal',
            listItem: 'number',
            level: 1,
            markDefs: [],
            children: [
              {
                _type: 'span',
                _key: 'text',
                text: 'مشتری جدید را انتخاب کنید.',
                marks: [],
              },
            ],
          },
        ],
      },
      publicOrigin: 'https://saluna.test',
    },
    request: new Request('https://saluna.test/guides/create-client'),
  })
  expect(html.match(/rel="canonical"/g)).toHaveLength(1)
  expect(html).toContain('href="https://saluna.test/guides/create-client"')
  expect(html).toContain('"@type":"TechArticle"')
  expect(html).toContain('<ol')
  expect(html).toContain('مشتری جدید را انتخاب کنید.')
  expect(html).toContain('آخرین بازبینی')
  expect(html).toContain('تیم محصول سالونا')
  expect(html).toContain('datetime="2026-10-08T09:00:00.000Z"')
})

it('keeps a video guide useful through transcript and related public guides in a private preview', async () => {
  const html = await (
    await AstroContainer.create()
  ).renderToString(ProductGuideLayout, {
    props: {
      guide: {
        id: 'video-guide',
        slug: 'video-example',
        title: 'نمونه ویدئو',
        bylines: ['تیم سالونا'],
        relatedGuides: [{ slug: 'create-client', title: 'افزودن مشتری' }],
        video_url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        video_transcript: 'مراحل مکتوب حتی بدون ویدئو در دسترس‌اند.',
      },
      publicOrigin: 'https://saluna.test',
      preview: true,
    },
    request: new Request(
      'https://saluna.test/guides/video-example?_preview=private',
    ),
  })
  expect(html).toContain(
    'src="https://www.youtube-nocookie.com/embed/jNQXAC9IVRw"',
  )
  expect(html).toContain('متن همراه ویدئو')
  expect(html).toContain('مراحل مکتوب حتی بدون ویدئو در دسترس‌اند.')
  expect(html).toContain('href="/guides/create-client"')
  expect(html).toContain('name="robots" content="noindex, nofollow"')
  expect(html).not.toContain('_preview=')
})
