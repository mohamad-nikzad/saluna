import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { SalonClosedError } from '@repo/database/settings'
import { error } from '../lib/responses'

export const errorHandler: ErrorHandler = (err, c: Context) => {
  if (err instanceof HTTPException) {
    return error(c, err.message, err.status)
  }
  if (err instanceof ZodError) {
    return error(c, err.issues[0]?.message ?? 'داده نامعتبر', 400)
  }
  if (err instanceof SalonClosedError) {
    return error(c, err.message, 409, err.code)
  }
  const requestId = c.get('requestId') ?? '-'
  console.error(`[api] [${requestId}] unhandled error:`, err)
  return error(c, 'خطای سرور. لطفاً دوباره تلاش کنید.', 500)
}

export const notFoundHandler: NotFoundHandler = (c) => {
  return error(c, 'Not Found', 404)
}
