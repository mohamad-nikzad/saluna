import type { Plugin } from 'vite'

import { getAdminCsp } from './csp'

const CSP_META =
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/

export function adminCspPlugin(port: number): Plugin {
  return {
    name: 'admin-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const isDev = ctx.server != null
        const csp = getAdminCsp(isDev, port)
        const metaTag = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`

        if (!CSP_META.test(html)) {
          throw new Error('index.html is missing a Content-Security-Policy meta tag')
        }

        return html.replace(CSP_META, metaTag)
      },
    },
  }
}
