import type { APIRoute } from 'astro'
import { PUBLIC_APP_URL } from 'astro:env/client'
import { readPublicBlogArticles } from '../lib/blog-content'
import { buildBlogCanonicalUrl } from '../lib/seo'

export const prerender = false

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  )
}

// Native discovery joins unrevisioned SEO. Read the same published fields as
// article HTML so a draft search setting cannot alter public discovery.
export const GET: APIRoute = async () => {
  const articles = await readPublicBlogArticles()
  const urls = articles
    .filter((article) => article.search_excluded !== true)
    .map((article) => {
      const canonical = buildBlogCanonicalUrl(article.slug, PUBLIC_APP_URL).href
      const date = article.modifiedAt ?? article.publishedAt
      return `  <url><loc>${escapeXml(canonical)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`
    })
    .join('\n')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
