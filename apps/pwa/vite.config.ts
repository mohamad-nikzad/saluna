import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const useHttps = process.env.VITE_DEV_HTTPS === '1'
const PWA_PORT = 3000

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    host: '0.0.0.0',
    port: PWA_PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: PWA_PORT,
    strictPort: true,
  },
  plugins: [
    ...(useHttps ? [basicSsl()] : []),
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
})

export default config
