import { afterEach, describe, expect, it, vi } from 'vitest'

import { getApiV1Clients } from './generated/sdk.gen'
import { ApiError, NetworkError } from './errors'
import { configureGeneratedApiClient } from './client'

describe('configureGeneratedApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('configures baseUrl, credentials, and bearer auth', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      expect(request.url).toBe('https://example.test/api/v1/clients')
      expect(request.credentials).toBe('include')
      expect(request.headers.get('Authorization')).toBe('Bearer token-123')

      return new Response(JSON.stringify({ clients: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    configureGeneratedApiClient({
      baseUrl: 'https://example.test/',
      credentials: 'include',
      getAccessToken: () => 'token-123',
    })

    await getApiV1Clients()

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('normalizes HTTP errors to ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    configureGeneratedApiClient({
      baseUrl: 'https://example.test',
    })

    await expect(getApiV1Clients()).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Forbidden',
      status: 403,
      payload: { error: 'Forbidden' },
    })
  })

  it('normalizes network failures to NetworkError', async () => {
    const cause = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(cause)))

    configureGeneratedApiClient({
      baseUrl: 'https://example.test',
    })

    await expect(getApiV1Clients()).rejects.toSatisfy(
      (error: unknown) => error instanceof NetworkError && error.cause === cause,
    )
  })

  it('does not double-wrap ApiError', async () => {
    const apiError = new ApiError('Already normalized', 401, { error: 'Already normalized' })

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(apiError)))

    configureGeneratedApiClient({
      baseUrl: 'https://example.test',
    })

    await expect(getApiV1Clients()).rejects.toBe(apiError)
  })

  it('attaches X-Saluna-Salon-Id from getSalonId', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      expect(request.headers.get('X-Saluna-Salon-Id')).toBe('salon-b')
      return new Response(JSON.stringify({ clients: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    configureGeneratedApiClient({
      baseUrl: 'https://example.test',
      getSalonId: () => 'salon-b',
    })

    await getApiV1Clients()
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
