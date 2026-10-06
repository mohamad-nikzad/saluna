import { defineMiddleware } from 'astro:middleware'
import { hasPermission } from '@emdash-cms/auth'

// Runs after EmDash resolves the CMS session and verifies the signed token.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, searchParams } = context.url
  if (
    (pathname === '/blog' || pathname.startsWith('/blog/')) &&
    searchParams.has('_preview') &&
    !hasPermission(context.locals.user, 'content:read_drafts')
  ) {
    return new Response('برای دیدن پیش‌نویس با حساب نویسنده وارد شوید.', {
      status: 403,
    })
  }
  return next()
})
