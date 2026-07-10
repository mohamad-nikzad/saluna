import { client } from './generated/client.gen'
import { ApiError, NetworkError } from './errors'

export type AccessTokenProvider = () => string | null | Promise<string | null>
export type SalonIdProvider = () => string | null | Promise<string | null>

export type GeneratedApiClientOptions = {
  baseUrl: string
  getAccessToken?: AccessTokenProvider
  /** Active salon context for tenant-scoped staff requests (X-Saluna-Salon-Id). */
  getSalonId?: SalonIdProvider
  credentials?: RequestCredentials
}

const SALON_CONTEXT_HEADER = 'X-Saluna-Salon-Id'

let errorInterceptorId: number | undefined
let requestInterceptorId: number | undefined
let accessTokenProvider: AccessTokenProvider | undefined
let salonIdProvider: SalonIdProvider | undefined

function extractErrorMessage(payload: unknown, status: number): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'string'
  ) {
    return (payload as { error: string }).error
  }

  if (typeof payload === 'string' && payload.length > 0) {
    return payload
  }

  return `Request failed with status ${status}`
}

function normalizeGeneratedError(
  error: unknown,
  response: Response | undefined,
): ApiError | NetworkError {
  if (error instanceof ApiError || error instanceof NetworkError) {
    return error
  }

  if (!response) {
    return new NetworkError(error)
  }

  return new ApiError(extractErrorMessage(error, response.status), response.status, error)
}

export function configureGeneratedApiClient(options: GeneratedApiClientOptions): void {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')

  accessTokenProvider = options.getAccessToken
  salonIdProvider = options.getSalonId

  client.setConfig({
    baseUrl,
    credentials: options.credentials,
    throwOnError: true,
    auth: options.getAccessToken
      ? async () => {
          const token = await options.getAccessToken!()
          return token ?? undefined
        }
      : undefined,
  })

  if (requestInterceptorId === undefined) {
    requestInterceptorId = client.interceptors.request.use(async (request) => {
      const headers = new Headers(request.headers)
      let changed = false

      if (accessTokenProvider && !headers.has('Authorization')) {
        const token = await accessTokenProvider()
        if (token) {
          headers.set('Authorization', `Bearer ${token}`)
          changed = true
        }
      }

      if (salonIdProvider && !headers.has(SALON_CONTEXT_HEADER)) {
        const salonId = await salonIdProvider()
        if (salonId) {
          headers.set(SALON_CONTEXT_HEADER, salonId)
          changed = true
        }
      }

      return changed ? new Request(request, { headers }) : request
    })
  }

  if (errorInterceptorId === undefined) {
    errorInterceptorId = client.interceptors.error.use((error, response) =>
      normalizeGeneratedError(error, response),
    )
  }
}
