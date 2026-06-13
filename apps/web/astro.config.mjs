// @ts-check
import fs from 'node:fs/promises'
import { defineConfig, envField, fontProviders } from 'astro/config'
import node from '@astrojs/node'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

const publicApiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:3002'

/** @type {string} */
let apiConnectOrigin
try {
  apiConnectOrigin = new URL(publicApiUrl).origin
} catch {
  apiConnectOrigin = 'http://localhost:3002'
}

/** Writes robots.txt with the production sitemap URL after build. */
function robotsSitemapIntegration() {
  return {
    name: 'robots-sitemap-url',
    hooks: {
      /** @param {{ dir: URL }} params */
      'astro:build:done': async ({ dir }) => {
        const site = (process.env.PUBLIC_APP_URL ?? 'http://localhost:3001').replace(
          /\/$/,
          '',
        )
        const robots = `User-agent: *
Allow: /

Sitemap: ${site}/sitemap-index.xml
`
        await fs.writeFile(new URL('robots.txt', dir), robots)
      },
    },
  }
}

const vazirmatnVariants = [400, 500, 600, 700, 800].map((weight) => ({
  weight,
  style: 'normal',
  src: [`./src/assets/fonts/vazirmatn-arabic-${weight}.woff2`],
  display: 'swap',
}))

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_APP_URL ?? 'http://localhost:3001',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), sitemap(), robotsSitemapIntegration()],
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
    responsiveStyles: true,
  },
  security: {
    csp: {
      directives: [`connect-src 'self' ${apiConnectOrigin}`],
    },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Vazirmatn',
      cssVariable: '--font-vazirmatn',
      options: { variants: vazirmatnVariants },
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.local(),
      name: 'Lalezar',
      cssVariable: '--font-lalezar',
      options: {
        variants: [
          {
            weight: 400,
            style: 'normal',
            src: ['./src/assets/fonts/lalezar-arabic-400.woff2'],
            display: 'swap',
          },
        ],
      },
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  env: {
    schema: {
      PUBLIC_APP_URL: envField.string({
        context: 'client',
        access: 'public',
        url: true,
        default: 'http://localhost:3001',
      }),
      PUBLIC_API_URL: envField.string({
        context: 'client',
        access: 'public',
        url: true,
        default: 'http://localhost:3002',
      }),
      PUBLIC_MANAGER_APP_URL: envField.string({
        context: 'client',
        access: 'public',
        url: true,
        default: 'http://localhost:3000',
      }),
    },
  },
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    ssr: { noExternal: ['@repo/api-client', '@repo/salon-core'] },
  },
})
