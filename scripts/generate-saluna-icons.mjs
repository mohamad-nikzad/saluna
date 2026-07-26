import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mastersDir = join(root, 'packages/brand/assets')
const pwaPublic = join(root, 'apps/pwa/public')
const pwaBrandDir = join(pwaPublic, 'brand')
const pwaIconsDir = join(pwaPublic, 'icons')
const webPublic = join(root, 'apps/web/public')
const webLandingDir = join(webPublic, 'landing')

const gradientMarkSource = join(mastersDir, 'saluna-mark-gradient.png')
const flatMarkSource = join(mastersDir, 'saluna-mark-flat.png')
const horizontalFaEnSource = join(
  mastersDir,
  'saluna-logo-horizontal-fa-en.png',
)

const background = { r: 248, g: 239, b: 240, alpha: 1 }
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function ensureParent(path) {
  await mkdir(dirname(path), { recursive: true })
}

async function trimmedPng(sourcePath) {
  return sharp(sourcePath).ensureAlpha().trim().png().toBuffer()
}

async function containOnCanvas(
  source,
  width,
  height,
  maxWidth,
  maxHeight,
  canvasBackground = transparent,
) {
  const image = await sharp(source)
    .resize({
      width: Math.round(maxWidth),
      height: Math.round(maxHeight),
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()
  const metadata = await sharp(image).metadata()
  const imageWidth = metadata.width ?? 0
  const imageHeight = metadata.height ?? 0

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: canvasBackground,
    },
  })
    .composite([
      {
        input: image,
        left: Math.round((width - imageWidth) / 2),
        top: Math.round((height - imageHeight) / 2),
      },
    ])
    .png()
    .toBuffer()
}

async function writePng(buffer, path) {
  await ensureParent(path)
  await sharp(buffer).png().toFile(path)
}

async function createFaviconIco(source) {
  const sizes = [16, 32, 48]
  const pngs = await Promise.all(
    sizes.map((size) =>
      containOnCanvas(source, size, size, size - 2, size - 2),
    ),
  )
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  let offset = header.length + sizes.length * 16
  const entries = pngs.map((bytes, index) => {
    const entry = Buffer.alloc(16)
    const size = sizes[index]
    entry.writeUInt8(size, 0)
    entry.writeUInt8(size, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(bytes.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += bytes.length
    return entry
  })

  return Buffer.concat([header, ...entries, ...pngs])
}

async function writeBrandAssets(gradientMark) {
  const mark = await sharp(gradientMark)
    .resize({ width: 1024 })
    .png()
    .toBuffer()
  const logoFaEn = await trimmedPng(horizontalFaEnSource)

  await writePng(mark, join(pwaBrandDir, 'saluna-mark.png'))
  await writePng(mark, join(webLandingDir, 'saluna-mark.png'))
  await writePng(
    logoFaEn,
    join(webLandingDir, 'saluna-logo-horizontal-fa-en.png'),
  )

  const squareMark = await containOnCanvas(mark, 1024, 1024, 760, 800)
  await writePng(squareMark, join(pwaPublic, 'logo.png'))
}

async function writePwaIcons(flatMark) {
  const standardBase = await containOnCanvas(
    flatMark,
    1024,
    1024,
    760,
    760,
    background,
  )
  const maskableBase = await containOnCanvas(
    flatMark,
    1024,
    1024,
    640,
    640,
    background,
  )

  for (const size of iconSizes) {
    const icon = await sharp(standardBase).resize(size, size).png().toBuffer()
    await writePng(icon, join(pwaIconsDir, `icon-${size}x${size}.png`))
  }

  for (const size of [192, 512]) {
    const icon = await sharp(maskableBase).resize(size, size).png().toBuffer()
    await writePng(icon, join(pwaIconsDir, `icon-maskable-${size}x${size}.png`))
  }

  const appleTouch = await sharp(standardBase).resize(180, 180).png().toBuffer()
  const favicon16 = await containOnCanvas(flatMark, 16, 16, 15, 15)
  const favicon32 = await containOnCanvas(flatMark, 32, 32, 30, 30)
  const faviconIco = await createFaviconIco(flatMark)

  await writePng(appleTouch, join(pwaPublic, 'apple-touch-icon.png'))
  await writePng(favicon16, join(pwaPublic, 'favicon-16x16.png'))
  await writePng(favicon32, join(pwaPublic, 'favicon-32x32.png'))
  await writeFile(join(pwaPublic, 'favicon.ico'), faviconIco)

  await writePng(appleTouch, join(webPublic, 'apple-touch-icon.png'))
  await writePng(favicon32, join(webPublic, 'favicon-32.png'))
  await writeFile(join(webPublic, 'favicon.ico'), faviconIco)
}

async function removeLegacyAssets() {
  const legacyPaths = [
    join(pwaBrandDir, 'saloora-logo-clean.png'),
    join(pwaBrandDir, 'saloora-mark-clean.png'),
    join(pwaBrandDir, 'saloora-mark-source.png'),
    join(webLandingDir, 'saloora-mark.png'),
    join(webPublic, 'favicon.svg'),
  ]
  await Promise.all(legacyPaths.map((path) => rm(path, { force: true })))
}

async function main() {
  await mkdir(pwaBrandDir, { recursive: true })
  await mkdir(pwaIconsDir, { recursive: true })
  await mkdir(webLandingDir, { recursive: true })

  const gradientMark = await trimmedPng(gradientMarkSource)
  const flatMark = await trimmedPng(flatMarkSource)

  await writeBrandAssets(gradientMark)
  await writePwaIcons(flatMark)
  await removeLegacyAssets()

  console.log('Generated Saluna brand assets for PWA and web.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
