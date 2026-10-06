import { defineMiddleware } from 'astro:middleware'
import { hasPermission } from '@emdash-cms/auth'

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, searchParams } = context.url
  if (pathname !== '/blog' && !pathname.startsWith('/blog/')) return next()

  const preview = searchParams.has('_preview')
  context.cache?.set(false)
  let response: Response
  if (preview && !hasPermission(context.locals.user, 'content:read_drafts')) {
    response = new Response('برای دیدن پیش‌نویس با حساب نویسنده وارد شوید.', {
      status: 403,
    })
  } else {
    try {
      response = await next()
    } catch (error) {
      console.error(
        '[blog] Content rendering failed',
        error instanceof Error ? error.name : 'UnknownError',
      )
      response = new Response('مقاله‌ها در حال حاضر در دسترس نیستند.', {
        status: 500,
      })
    }
  }
  // The policy also covers denied, invalid-token, unknown-entry and error
  // responses. Neither Astro's route cache nor a proxy may retain previews.
  response = new Response(response.body, response)
  response.headers.set('Cache-Control', 'private, no-store')
  if (preview) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.append('Vary', 'Cookie')
  }
  return response
})
