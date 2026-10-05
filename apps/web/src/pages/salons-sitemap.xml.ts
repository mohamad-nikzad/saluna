import type { APIRoute } from 'astro'
import { PUBLIC_API_URL, PUBLIC_APP_URL } from 'astro:env/client'
import { buildSalonCanonicalUrl, isSalonIndexable } from '../lib/seo'

const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=3600'

async function getPublishedSalonSlugs(): Promise<string[]> {
  const response = await fetch(
    new URL(
      '/api/v1/public/salons',
      process.env.API_INTERNAL_URL || PUBLIC_API_URL,
    ),
  )
  if (!response.ok) throw new Error('Could not load published Salon slugs')

  const body: unknown = await response.json()
  if (
    !body ||
    typeof body !== 'object' ||
    !('slugs' in body) ||
    !Array.isArray(body.slugs) ||
    !body.slugs.every((slug): slug is string => typeof slug === 'string')
  ) {
    throw new Error('Invalid published Salon slugs response')
  }

  return body.slugs
}

export const GET: APIRoute = async () => {
  const slugs = await getPublishedSalonSlugs()
  const urls = slugs
    .filter(isSalonIndexable)
    .map(
      (slug) =>
        `  <url><loc>${buildSalonCanonicalUrl(slug, PUBLIC_APP_URL)}</loc></url>`,
    )
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  return new Response(xml, {
    headers: {
      'Cache-Control': CACHE_CONTROL,
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
