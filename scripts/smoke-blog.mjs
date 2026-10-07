import assert from 'node:assert/strict'
import sharp from 'sharp'

/** Public HTTP checks shared by deployment smoke and the real CMS lifecycle. */
export async function checkBlogDiscovery(
  base,
  { present = [], absent = [], robotsOrigin = base } = {},
) {
  const response = await fetch(new URL('/blog-sitemap.xml', base), {
    cache: 'no-store',
  })
  assert.equal(response.status, 200, 'Blog sitemap must load')
  assert.match(response.headers.get('content-type') ?? '', /application\/xml/)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  const xml = await response.text()
  assert.match(
    xml,
    /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/,
  )
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
  assert.equal(
    new Set(urls).size,
    urls.length,
    'Sitemap must not duplicate URLs',
  )
  for (const url of urls) {
    assert.equal(new URL(url).origin, new URL(base).origin)
    assert.match(new URL(url).pathname, /^\/blog\/[^/]+$/)
    assert.equal(new URL(url).search, '')
  }
  for (const slug of present)
    assert.ok(
      urls.includes(new URL(`/blog/${encodeURIComponent(slug)}`, base).href),
      `Missing published ${slug}`,
    )
  for (const slug of absent)
    assert.ok(
      !urls.includes(new URL(`/blog/${encodeURIComponent(slug)}`, base).href),
      `Unexpected unpublished or former ${slug}`,
    )
  for (const match of xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)) {
    assert.equal(
      new Date(match[1]).toISOString(),
      match[1],
      'Sitemap date must be ISO UTC',
    )
  }
  const robots = await (await fetch(new URL('/robots.txt', base))).text()
  for (const path of [
    '/sitemap-index.xml',
    '/salons-sitemap.xml',
    '/blog-sitemap.xml',
  ]) {
    assert.ok(
      robots.includes(`Sitemap: ${new URL(path, robotsOrigin).href}`),
      `Robots must advertise ${path}`,
    )
  }
  return urls
}

export async function checkBlogArticle(url) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'manual' })
  assert.equal(response.status, 200, 'Published article must load')
  const html = await response.text()
  const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)]
  assert.equal(canonical.length, 1, 'Article must have one canonical')
  assert.equal(canonical[0][1], new URL(url).href)
  assert.equal([...html.matchAll(/<title>(.*?)<\/title>/gs)].length, 1)
  const meta = (attribute, key) =>
    html.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]+)"`))?.[1]
  assert.ok(meta('name', 'description'), 'Article needs a description')
  assert.equal(meta('property', 'og:type'), 'article')
  assert.equal(meta('property', 'og:url'), canonical[0][1])
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
    ),
  ].map((match) => JSON.parse(match[1]))
  const article = blocks.find((value) => value['@type'] === 'Article')
  assert.ok(article, 'Article structured data must exist')
  assert.ok(article.headline)
  assert.equal(article.url, canonical[0][1])
  assert.equal(article.mainEntityOfPage, canonical[0][1])
  assert.ok(article.author.length)
  for (const date of [article.datePublished, article.dateModified]) {
    assert.ok(date, 'Published and revision dates must exist')
    assert.equal(new Date(date).toISOString(), date)
  }
  const image = meta('property', 'og:image')
  assert.equal(image, meta('name', 'twitter:image'))
  assert.equal(image, article.image)
  const social = await fetch(image)
  assert.equal(social.status, 200, 'Social image must load')
  assert.match(social.headers.get('content-type') ?? '', /^image\//)
  const dimensions = await sharp(
    Buffer.from(await social.arrayBuffer()),
  ).metadata()
  assert.ok(dimensions.width && dimensions.height, 'Social image must decode')
  assert.equal(String(dimensions.width), meta('property', 'og:image:width'))
  assert.equal(String(dimensions.height), meta('property', 'og:image:height'))
  return article
}
