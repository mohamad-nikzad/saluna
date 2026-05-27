import { createNextConfig } from '@repo/next-config'

const config = createNextConfig({
  pwa: true,
  transpilePackages: ['@repo/ui', '@repo/salon-core', '@repo/database', '@repo/auth'],
})

const USE_HONO_API = process.env.USE_HONO_API === '1' || process.env.USE_HONO_API === 'true'
const HONO_API_URL = process.env.HONO_API_URL ?? 'http://localhost:3002'

// Domains mounted by the Hono server at /api/v1/<domain>.
// When USE_HONO_API is enabled we proxy `/api/<domain>/*` to Hono so that
// existing client code (which still hits `/api/...`) goes to the new server
// without touching any callsite. Next.js route handlers stay in place as a
// fallback when the flag is off.
const HONO_DOMAINS = [
  'auth',
  'clients',
  'appointments',
  'services',
  'service-addons',
  'service-categories',
  'service-families',
  'staff',
  'settings',
  'salon-public-settings',
  'notifications',
  'notification-preferences',
  'push',
  'onboarding',
  'retention',
  'dashboard',
  'today',
  'public',
  'appointment-requests',
]

export default {
  ...config,
  allowedDevOrigins: ['192.168.1.3', '192.168.1.21'],
  async rewrites() {
    const existing = config.rewrites ? await config.rewrites() : []
    const existingBefore = Array.isArray(existing)
      ? []
      : Array.isArray(existing?.beforeFiles)
        ? existing.beforeFiles
        : []
    const existingAfter = Array.isArray(existing)
      ? existing
      : Array.isArray(existing?.afterFiles)
        ? existing.afterFiles
        : []
    const existingFallback = Array.isArray(existing)
      ? []
      : Array.isArray(existing?.fallback)
        ? existing.fallback
        : []

    if (!USE_HONO_API) {
      return existing
    }

    const honoRewrites = HONO_DOMAINS.flatMap((domain) => [
      {
        source: `/api/${domain}`,
        destination: `${HONO_API_URL}/api/v1/${domain}`,
      },
      {
        source: `/api/${domain}/:path*`,
        destination: `${HONO_API_URL}/api/v1/${domain}/:path*`,
      },
    ])

    return {
      beforeFiles: [...existingBefore, ...honoRewrites],
      afterFiles: existingAfter,
      fallback: existingFallback,
    }
  },
  async headers() {
    const headers = config.headers ? await config.headers() : []

    return [
      ...headers,
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, Accept',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ]
  },
}
