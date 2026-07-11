/**
 * Writes brand name into PWA static files from @repo/brand.
 * Run after changing packages/brand/src/config.ts: pnpm brand:sync
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandCopy } from '../packages/brand/src/copy.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pwaPublic = join(root, 'apps/pwa/public')
const pwaRoot = join(root, 'apps/pwa')

async function patchManifest() {
  const path = join(pwaPublic, 'manifest.webmanifest')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  manifest.name = brandCopy.pwaFullName
  manifest.short_name = brandCopy.pwaShortName
  manifest.description = brandCopy.pwaDescription
  if (Array.isArray(manifest.screenshots)) {
    for (const shot of manifest.screenshots) {
      if (typeof shot.label === 'string' && shot.label.includes('سال')) {
        shot.label = shot.label.replace(
          /سالونا|سالورا/g,
          brandCopy.pwaShortName,
        )
      }
    }
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function patchHtml(path, { title, appName, description }) {
  let html = await readFile(path, 'utf8')
  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  }
  if (appName) {
    html = html.replace(
      /content="[^"]*"(\s+name="application-name")/,
      `content="${brandCopy.pwaShortName}"$1`,
    )
    html = html.replace(
      /content="[^"]*"(\s+name="apple-mobile-web-app-title")/,
      `content="${brandCopy.pwaShortName}"$1`,
    )
  }
  if (description) {
    html = html.replace(
      /content="[^"]*"(\s+name="description")/,
      `content="${brandCopy.pwaDescription}"$1`,
    )
  }
  await writeFile(path, html)
}

async function patchSw() {
  const path = join(pwaPublic, 'sw.js')
  let js = await readFile(path, 'utf8')
  js = js.replace(
    /if \(pathname\.startsWith\('\/signup'\)\) return '[^']+'\n  return '[^']+'/,
    `if (pathname.startsWith('/signup')) return 'ثبت‌نام'\n  return '${brandCopy.pwaShortName}'`,
  )
  js = js.replace(
    /let payload = \{ title: '[^']+'/,
    `let payload = { title: '${brandCopy.pwaShortName}'`,
  )
  await writeFile(path, js)
}

await patchManifest()
await patchHtml(join(pwaRoot, 'index.html'), {
  title: brandCopy.pwaShortName,
  appName: true,
  description: true,
})
await patchHtml(join(pwaPublic, 'offline-launch.html'), {
  title: `${brandCopy.pwaShortName} - شروع آفلاین`,
})
await patchSw()
console.log('Synced PWA static brand copy from @repo/brand')
