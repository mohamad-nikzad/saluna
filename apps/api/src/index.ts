import { serve } from '@hono/node-server'
import { app } from './app'
import { bootstrapMessagingProviders } from './bootstrap-messaging'
import { getEnv } from './env'

bootstrapMessagingProviders()

const env = getEnv()

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[api] listening on http://${info.address}:${info.port}`)
})

async function shutdown(signal: NodeJS.Signals) {
  console.log(`[api] received ${signal}, shutting down`)
  server.close((err) => {
    if (err) console.error('[api] server close error:', err)
  })
  try {
    const g = globalThis as { __salon_postgres?: { end: () => Promise<void> } }
    if (g.__salon_postgres) {
      await g.__salon_postgres.end()
    }
  } catch (err) {
    console.error('[api] postgres pool close error:', err)
  }
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
