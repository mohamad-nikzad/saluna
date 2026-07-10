import { describe, it, expect, vi } from 'vitest'

const configureGeneratedApiClient = vi.fn()

vi.mock('@repo/api-client/generated-client', () => ({
  configureGeneratedApiClient,
}))

vi.mock('#/env', () => ({
  env: { apiBaseUrl: 'http://test.api' },
}))

await import('#/lib/generated-api-client')

describe('generated-api-client', () => {
  it('configures the generated client at module load', () => {
    expect(configureGeneratedApiClient).toHaveBeenCalledWith({
      baseUrl: 'http://test.api',
      credentials: 'include',
      getSalonId: expect.any(Function),
    })
  })
})
