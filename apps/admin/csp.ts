/**
 * Content-Security-Policy for the Saluna Admin SPA.
 *
 * Production keeps script-src strict ('self' only) because Vite emits bundled ES
 * modules with no inline scripts. Dev relaxes script-src and connect-src for Vite
 * HMR (inline bootstrap scripts + WebSocket to the dev server).
 *
 * style-src allows 'unsafe-inline' in all modes: Tailwind v4 and component
 * libraries inject runtime styles. connect-src stays 'self' in production because
 * the API client uses same-origin /api (proxied to the backend in dev/preview).
 *
 * Deployed environments should mirror preview.headers from vite.config.ts at the
 * reverse proxy/CDN layer; the meta tag covers static hosting without headers.
 */

const BASE_DIRECTIVES: Record<string, readonly string[]> = {
  'default-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'form-action': ["'self'"],
}

function devConnectSrc(port: number): readonly string[] {
  return [
    "'self'",
    `ws://localhost:${port}`,
    `ws://127.0.0.1:${port}`,
    `ws://[::1]:${port}`,
  ]
}

function serializeDirectives(directives: Record<string, readonly string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/** Production CSP — also the static fallback in index.html before Vite rewrites it. */
export const adminCspProduction = serializeDirectives({
  ...BASE_DIRECTIVES,
  'script-src': ["'self'"],
  'connect-src': ["'self'"],
})

/** Dev CSP — allows Vite HMR inline scripts and WebSocket connections. */
export function getAdminCspDev(port: number): string {
  return serializeDirectives({
    ...BASE_DIRECTIVES,
    'script-src': ["'self'", "'unsafe-inline'"],
    'connect-src': devConnectSrc(port),
  })
}

export function getAdminCsp(isDev: boolean, port = 3003): string {
  return isDev ? getAdminCspDev(port) : adminCspProduction
}
