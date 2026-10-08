import type { APIRoute } from 'astro'
import { PUBLIC_APP_URL } from 'astro:env/client'
import { readPublicBlogArticles } from '../lib/public-content'
import { buildBlogCanonicalUrl } from '../lib/seo'
import { publishedContentSitemap } from '../lib/content-sitemap'

export const prerender = false

export const GET: APIRoute = async () =>
  publishedContentSitemap(
    await readPublicBlogArticles(),
    (slug) => buildBlogCanonicalUrl(slug, PUBLIC_APP_URL).href,
  )
