interface PublishedSitemapEntry {
  slug: string
  publishedAt?: string
  modifiedAt?: string
  search_excluded?: boolean
}

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

// Use the same published fields as HTML; native discovery joins unrevisioned
// SEO. Collection readers and canonical URL ownership remain with each route.
export function publishedContentSitemap(
  entries: PublishedSitemapEntry[],
  canonicalUrl: (slug: string) => string,
): Response {
  const urls = entries
    .filter((entry) => entry.search_excluded !== true)
    .map((entry) => {
      const date = entry.modifiedAt ?? entry.publishedAt
      return `  <url><loc>${escapeXml(canonicalUrl(entry.slug))}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`
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
