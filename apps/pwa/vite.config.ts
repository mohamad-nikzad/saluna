import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import {
  DEFAULT_PWA_ASSET_VERSION,
  injectPwaAssetVersion,
} from './pwa-assets.config'

const useHttps = process.env.VITE_DEV_HTTPS === '1'
const PWA_PORT = 3000
const API_PORT = Number(process.env.API_PORT ?? 3002)

function pwaAssetVersionPlugin(version: string): Plugin {
  let outDir = ''

  return {
    name: 'pwa-asset-version',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml(html) {
      return injectPwaAssetVersion(html, version)
    },
    configureServer(server) {
      server.middlewares.use(
        '/manifest.webmanifest',
        async (_request, response) => {
          const manifestPath = join(
            process.cwd(),
            'public/manifest.webmanifest',
          )
          const manifest = await readFile(manifestPath, 'utf8')
          response.setHeader('Content-Type', 'application/manifest+json')
          response.setHeader('Cache-Control', 'no-cache')
          response.end(injectPwaAssetVersion(manifest, version))
        },
      )
    },
    async writeBundle() {
      const manifestPath = join(outDir, 'manifest.webmanifest')
      const manifest = await readFile(manifestPath, 'utf8')
      await writeFile(manifestPath, injectPwaAssetVersion(manifest, version))
    },
  }
}

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pwaAssetVersion =
    env.VITE_PWA_ASSET_VERSION || DEFAULT_PWA_ASSET_VERSION

  return {
    resolve: { tsconfigPaths: true },
    server: {
      host: '0.0.0.0',
      port: PWA_PORT,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${API_PORT}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: PWA_PORT,
      strictPort: true,
    },
    plugins: [
      pwaAssetVersionPlugin(pwaAssetVersion),
      ...(useHttps ? [basicSsl()] : []),
      devtools(),
      tailwindcss(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
    ],
  }
})

export default config
