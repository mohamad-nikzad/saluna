/**
 * Replaces wordmark PNGs that still render "Saloora" with the cherry-blossom mark only.
 * Run: node scripts/refresh-brand-wordmarks.mjs
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const markPath = join(root, 'apps/pwa/public/brand/saloora-mark-clean.png')

const outputs = [
  join(root, 'apps/pwa/public/brand/saloora-logo-clean.png'),
  join(root, 'apps/pwa/public/logo.png'),
  join(root, 'apps/web/public/landing/saloora-mark.png'),
]

async function writeMarkLogo(outPath, width) {
  await mkdir(dirname(outPath), { recursive: true })
  const mark = await sharp(markPath)
    .resize(width, width, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const meta = await sharp(mark).metadata()
  const w = meta.width ?? width
  const h = meta.height ?? width
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: 0, top: 0 }])
    .png()
    .toFile(outPath)
}

async function main() {
  await writeMarkLogo(outputs[0], 512)
  await writeMarkLogo(outputs[1], 1024)
  await copyFile(markPath, outputs[2])
  console.log('Refreshed mark-only brand assets (no Saloora wordmark):')
  for (const p of outputs) console.log(`  ${p}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
