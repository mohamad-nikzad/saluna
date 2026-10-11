import { defineMiddleware } from 'astro:middleware'
import { hasPermission } from '@emdash-cms/auth'
import { createContentAccess, type ContentListResponse } from 'emdash'
import { withEmDashRuntime } from 'emdash/middleware'

// Runs after EmDash resolves the CMS session and verifies the signed token.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, searchParams } = context.url
  if (
    (pathname === '/blog' ||
      pathname.startsWith('/blog/') ||
      pathname === '/guides' ||
      pathname.startsWith('/guides/')) &&
    searchParams.has('_preview') &&
    !hasPermission(context.locals.user, 'content:read_drafts')
  ) {
    return new Response('برای دیدن پیش‌نویس با حساب نویسنده وارد شوید.', {
      status: 403,
    })
  }
  const response = await next()
  const collection = pathname.match(
    /^\/_emdash\/api\/content\/(blog_articles|product_guides)\/?$/,
  )?.[1]
  if (
    context.request.method !== 'GET' ||
    !collection ||
    !hasPermission(context.locals.user, 'content:read_drafts') ||
    !response.ok
  )
    return response

  // EmDash 1.1.0 lists base-record titles even when its editor loads a newer
  // draft revision. Project that revision's title for draft readers only;
  // keep native filtering, pagination and publication metadata intact.
  const result: { success: boolean; data: ContentListResponse } =
    await response.json()
  if (!result.success || !Array.isArray(result.data?.items))
    return Response.json(result, response)
  await withEmDashRuntime(async (runtime) => {
    const content = createContentAccess(runtime.db, { revisions: true })
    await Promise.all(
      result.data.items.map(async (item) => {
        if (!item.draftRevisionId) return
        const revision = await content.getRevision!(
          collection,
          item.id,
          item.draftRevisionId,
        )
        if (typeof revision?.data.title === 'string')
          item.data.title = revision.data.title
      }),
    )
  })
  const headers = new Headers(response.headers)
  headers.delete('Content-Length')
  return Response.json(result, { status: response.status, headers })
})
