#!/usr/bin/env node
/**
 * Downloads self-hosted fonts for apps/web and apps/pwa (air-gapped / Iran VPS).
 * Run from repo root: node scripts/fetch-web-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

const webFontDir = path.resolve(root, '../apps/web/src/assets/fonts')
const pwaFontDir = path.resolve(root, '../apps/pwa/public/fonts/vazirmatn')

const fontsourceBase =
  'https://cdn.jsdelivr.net/npm/@fontsource/vazirmatn@5.1.1/files'

/** @type {{ url: string; file: string; outDir: string }[]} */
const files = [
  ...[400, 500, 600, 700, 800].map((weight) => ({
    url: `${fontsourceBase}/vazirmatn-arabic-${weight}-normal.woff2`,
    file: `vazirmatn-arabic-${weight}.woff2`,
    outDir: webFontDir,
  })),
  ...[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => ({
    url: `${fontsourceBase}/vazirmatn-arabic-${weight}-normal.woff2`,
    file: `vazirmatn-${weight}.woff2`,
    outDir: pwaFontDir,
  })),
  {
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/lalezar@5.2.5/files/lalezar-arabic-400-normal.woff2',
    file: 'lalezar-arabic-400.woff2',
    outDir: webFontDir,
  },
  {
    url: 'https://github.com/rastikerdar/vazirmatn/raw/master/fonts/ttf/Vazirmatn-Bold.ttf',
    file: 'Vazirmatn-Bold.ttf',
    outDir: webFontDir,
  },
]

for (const dir of new Set(files.map((file) => file.outDir))) {
  await mkdir(dir, { recursive: true })
}

for (const { url, file, outDir } of files) {
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Failed ${file}: ${res.status} ${url}`)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(path.join(outDir, file), buf)
  console.log(`wrote ${path.join(outDir, file)}`)
}

console.log('Fonts saved.')
