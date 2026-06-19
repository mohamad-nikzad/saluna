import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { getAdminCsp } from './csp'
import { adminCspPlugin } from './vite-csp-plugin'

const ADMIN_PORT = 3003

function adminSecurityHeaders(isDev: boolean) {
  return {
    'Content-Security-Policy': getAdminCsp(isDev, ADMIN_PORT),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }
}

export default defineConfig(({ command, isPreview }) => {
  const isViteDev = command === 'serve' && !isPreview

  return {
    resolve: { tsconfigPaths: true },
    server: {
      host: '0.0.0.0',
      port: ADMIN_PORT,
      strictPort: true,
      headers: adminSecurityHeaders(isViteDev),
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3002',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: ADMIN_PORT,
      strictPort: true,
      headers: adminSecurityHeaders(false),
    },
    plugins: [
      adminCspPlugin(ADMIN_PORT),
      tailwindcss(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      viteReact(),
    ],
  }
})
