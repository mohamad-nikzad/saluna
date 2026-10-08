export function buildRobotsTxt(publicOrigin: string): string {
  const origin = new URL(publicOrigin).origin
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap-index.xml
Sitemap: ${origin}/salons-sitemap.xml
Sitemap: ${origin}/blog-sitemap.xml
Sitemap: ${origin}/guides-sitemap.xml
`
}
