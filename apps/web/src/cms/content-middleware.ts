import { defineMiddleware } from 'astro:middleware'
import { createRedirectAccess } from 'emdash'
import { withEmDashRuntime } from 'emdash/middleware'
import { readPublicBlogArticle, readPublicGuide } from '../lib/public-content'

// Native automatic rules outlive withdrawal and their per-worker cache can
// lag successive renames. Read supported redirect access freshly, without
// writing rules or duplicating the CMS publication lifecycle.
async function contentRedirect(
  path: string,
): Promise<string | null | undefined> {
  return withEmDashRuntime(async (runtime) => {
    const redirects = createRedirectAccess(runtime.db)
    let cursor: string | undefined
    do {
      const page = await redirects.list({
        search: path,
        auto: true,
        enabled: true,
        limit: 100,
        cursor,
      })
      const rule = page.items.find(
        (item) => !item.isPattern && item.source.replace(/\/+$/, '') === path,
      )
      if (rule) {
        const match = rule.destination.match(/^\/(blog|guides)\/([^/?#]+)\/?$/)
        if (!match) return null
        const slug = decodeURIComponent(match[2])
        if (slug.includes('/') || slug.includes('\\')) return null
        if (match[1] !== path.split('/')[1]) return null
        const article = await (
          match[1] === 'guides' ? readPublicGuide : readPublicBlogArticle
        )(slug)
        return article
          ? `/${match[1]}/${encodeURIComponent(article.slug)}`
          : null
      }
      cursor = page.cursor
    } while (cursor)
    return undefined
  })
}

// EmDash's supported outer boundary also sees its early redirects and Astro
// misses. Response privacy belongs here rather than only in matched pages.
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next()
  const { pathname, searchParams } = context.url
  if (
    pathname !== '/blog-sitemap.xml' &&
    pathname !== '/guides-sitemap.xml' &&
    pathname !== '/guides' &&
    !pathname.startsWith('/guides/') &&
    pathname !== '/blog' &&
    !pathname.startsWith('/blog/')
  )
    return next()

  const preview = searchParams.has('_preview')
  context.cache?.set(false)
  let response: Response
  try {
    response = await next()
    // Native early redirects skip session/token middleware and discard query
    // parameters. An obsolete preview address must fail closed.
    if (preview && response.status >= 300 && response.status < 400) {
      response = new Response('محتوا یافت نشد.', { status: 404 })
    }
    const canonical = pathname.replace(/\/+$/, '')
    const match = canonical.match(/^\/(blog|guides)\/([^/]+)$/)
    const destination =
      !preview && match ? await contentRedirect(canonical) : undefined
    if (destination !== undefined) {
      response = destination
        ? context.redirect(destination + context.url.search, 301)
        : new Response('محتوا یافت نشد.', { status: 404 })
    } else if (!preview && pathname.endsWith('/')) {
      if (
        canonical === '/blog' ||
        canonical === '/guides' ||
        (match &&
          (await (
            match[1] === 'guides' ? readPublicGuide : readPublicBlogArticle
          )(decodeURIComponent(match[2]))))
      ) {
        response = context.redirect(canonical + context.url.search, 301)
      }
    }
  } catch (error) {
    console.error(
      '[public-content] Content rendering failed',
      error instanceof Error ? error.name : 'UnknownError',
    )
    response = new Response('محتوا در حال حاضر در دسترس نیست.', {
      status: 500,
    })
  }
  response = new Response(response.body, response)
  response.headers.set('Cache-Control', 'private, no-store')
  if (preview) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.append('Vary', 'Cookie')
  }
  return response
})
