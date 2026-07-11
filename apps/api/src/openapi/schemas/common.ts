import { z } from '@hono/zod-openapi'

export const idParamSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .openapi({
        param: { name: 'id', in: 'path' },
        example: '550e8400-e29b-41d4-a716-446655440000',
      }),
  })
  .openapi('IdParam')

export const apiErrorSchema = z
  .object({
    error: z.string().openapi({ example: 'دسترسی غیرمجاز' }),
    code: z.string().optional().openapi({ example: 'duplicate-phone' }),
  })
  .openapi('ApiError')

export const tenantSecurity = [{ bearerAuth: [] }, { sessionCookie: [] }] as [
  { bearerAuth: string[] },
  { sessionCookie: string[] },
]
