import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('3002')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive()),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .default('*')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  MESSAGING_LINK_TOKEN_TTL_MINUTES: z
    .string()
    .default('15')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive()),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

export function getEnv(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment: ${messages}`)
  }
  cached = parsed.data
  return cached
}
