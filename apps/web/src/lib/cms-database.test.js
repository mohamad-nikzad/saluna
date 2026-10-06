import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDialect } from '../../cms/database.mjs'

afterEach(() => vi.unstubAllEnvs())

describe('CMS credential boundary', () => {
  it('requires CMS credentials even when an operational URL is available', () => {
    vi.stubEnv('CMS_DATABASE_URL', undefined)
    vi.stubEnv('DATABASE_URL', 'postgresql://operator:private@localhost/salon')
    expect(() => createDialect()).toThrow('CMS_DATABASE_URL is required')
  })

  it('refuses the operational database or an administrative login', () => {
    for (const url of [
      'postgresql://operator:private@localhost/saluna_cms',
      'postgresql://saluna_cms:private@localhost/salon',
      'invalid-secret-value',
    ]) {
      vi.stubEnv('CMS_DATABASE_URL', url)
      expect(() => createDialect()).toThrow(/CMS_DATABASE_URL/)
      try {
        createDialect()
      } catch (error) {
        expect(error.message).not.toContain('private')
        expect(error.message).not.toContain('invalid-secret-value')
      }
    }
  })

  it('requires a retained encryption key', () => {
    vi.stubEnv(
      'CMS_DATABASE_URL',
      'postgresql://saluna_cms:private@localhost/saluna_cms',
    )
    vi.stubEnv('EMDASH_ENCRYPTION_KEY', undefined)
    expect(() => createDialect()).toThrow('EMDASH_ENCRYPTION_KEY is required')
  })
})
