import type { APIRoute } from 'astro'
import { PUBLIC_APP_URL } from 'astro:env/client'
import { readPublicGuides } from '../lib/public-content'
import { buildGuideCanonicalUrl } from '../lib/seo'
import { publishedContentSitemap } from '../lib/content-sitemap'

export const prerender = false

export const GET: APIRoute = async () =>
  publishedContentSitemap(
    await readPublicGuides(),
    (slug) => buildGuideCanonicalUrl(slug, PUBLIC_APP_URL).href,
  )
