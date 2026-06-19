import { ApiError, NetworkError } from './errors'

export type TokenProvider = () => string | null | Promise<string | null>

export type ApiClientOptions = {
  baseUrl: string
  getToken?: TokenProvider
  fetchImpl?: typeof fetch
  // Sent on every request as a fallback when no bearer token is present.
  // Web (cookie session) → 'include'. Native (bearer only) → 'omit'.
  credentials?: RequestCredentials
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export type ApiClient = {
  request: <T = unknown>(path: string, opts?: RequestOptions) => Promise<T>
  baseUrl: string
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl.replace(/\/+$/, '')

  async function request<T>(
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...opts.headers,
    }

    const token = options.getToken ? await options.getToken() : null
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }

    let response: Response
    try {
      response = await fetchImpl(url, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        credentials: options.credentials,
        signal: opts.signal,
      })
    } catch (err) {
      throw new NetworkError(err)
    }

    const text = await response.text()
    let payload: unknown = undefined
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }

    if (!response.ok) {
      const message =
        (payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : null) ??
        (payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof (payload as { message: unknown }).message === 'string'
          ? (payload as { message: string }).message
          : null) ??
        `Request failed with status ${response.status}`
      throw new ApiError(message, response.status, payload)
    }

    return payload as T
  }

  return { request, baseUrl }
}
