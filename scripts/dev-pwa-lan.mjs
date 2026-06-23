import os from 'node:os'
import { spawn } from 'node:child_process'

function findLanIp() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return null
}

const host = process.env.MOBILE_DEV_HOST ?? findLanIp()
const pwaPort = process.env.MOBILE_DEV_PWA_PORT ?? '3000'
const apiPort = process.env.MOBILE_DEV_API_PORT ?? '3002'

if (!host) {
  console.error(
    'Could not detect a LAN IP. Set MOBILE_DEV_HOST to your computer IP, then rerun.',
  )
  process.exit(1)
}

const appUrl = `https://${host}:${pwaPort}`

const children = [
  spawn('pnpm', ['--filter', '@repo/api', 'dev'], {
    env: {
      ...process.env,
      PORT: apiPort,
    },
    detached: process.platform !== 'win32',
    stdio: 'inherit',
  }),
  spawn(
    'pnpm',
    ['--filter', '@repo/pwa', 'exec', 'vite', 'dev', '--host', '0.0.0.0', '--port', pwaPort, '--strictPort'],
    {
      env: {
        ...process.env,
        VITE_DEV_HTTPS: '1',
        VITE_API_BASE_URL: appUrl,
        VITE_APP_URL: appUrl,
      },
      detached: process.platform !== 'win32',
      stdio: 'inherit',
    },
  ),
]

console.log('')
console.log('PWA (HTTPS — required for Android Contact Picker):')
console.log(`  ${appUrl}`)
console.log('')
console.log(`API proxied via PWA at ${appUrl}/api → 127.0.0.1:${apiPort}`)
console.log('Phone must be on the same Wi‑Fi. Accept the self-signed certificate warning in Chrome.')
console.log('')

let shuttingDown = false

function killChild(child, signal) {
  if (child.killed || child.exitCode !== null) return

  try {
    if (process.platform === 'win32') {
      child.kill(signal)
    } else {
      process.kill(-child.pid, signal)
    }
  } catch (err) {
    if (err?.code !== 'ESRCH') {
      console.error(`Failed to send ${signal} to child process ${child.pid}:`, err)
    }
  }
}

function shutdown(signal = 'SIGTERM') {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    killChild(child, signal)
  }

  setTimeout(() => {
    for (const child of children) {
      killChild(child, 'SIGKILL')
    }
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }, 1500).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGHUP', () => shutdown('SIGHUP'))
process.on('exit', () => {
  if (!shuttingDown) shutdown('SIGTERM')
})

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    shutdown(signal ?? 'SIGTERM')
    process.exit(code ?? 1)
  })
}
