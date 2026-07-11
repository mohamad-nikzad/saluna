import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSession, verifySession } from './auth'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session secret hardening', () => {
  it('uses a development-only fallback outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('JWT_SECRET', '')

    const token = await createSession('user-1')

    await expect(verifySession(token)).resolves.toBe('user-1')
  })

  it('requires JWT_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', '')

    await expect(createSession('user-1')).rejects.toThrow(
      'JWT_SECRET is required',
    )
  })

  it('rejects weak production JWT_SECRET values', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', 'short-secret')

    await expect(createSession('user-1')).rejects.toThrow(
      'at least 32 characters',
    )
  })
})
