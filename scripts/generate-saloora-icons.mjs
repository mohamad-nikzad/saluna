import { execFile } from 'node:child_process'
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

const execFileAsync = promisify(execFile)

const root = new URL('..', import.meta.url).pathname
const pwaPublic = join(root, 'apps/pwa/public')
const brandDir = join(pwaPublic, 'brand')
const iconsDir = join(pwaPublic, 'icons')
const tempDir = join(root, 'node_modules/.cache/saluna-pwa-assets')

const originalSourcePath = join(brandDir, 'saloora-mark-source.png')
const cleanMarkPath = join(brandDir, 'saloora-mark-clean.png')
const preparedSourcePath = join(tempDir, 'saluna-mark-pwa-source.png')

const legacyIconSizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function ensureOutput(path) {
  await mkdir(dirname(path), { recursive: true })
}

async function prepareCleanMark() {
  const source = sharp(originalSourcePath).ensureAlpha()
  const { width = 0, height = 0 } = await source.metadata()
  const { data } = await source.raw().toBuffer({ resolveWithObject: true })
  const cleaned = Buffer.from(data)

  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      const red = data[(y * width + x) * 4]
      const green = data[(y * width + x) * 4 + 1]
      const blue = data[(y * width + x) * 4 + 2]
      if (red < 35 && green < 35 && blue < 35) {
        cleaned[(y * width + x) * 4 + 3] = 0
      }
      if (alpha <= 60) continue
      if (red < 35 && green < 35 && blue < 35) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (minX >= width || minY >= height) {
    throw new Error(`Could not find visible pixels in ${originalSourcePath}`)
  }

  const cropWidth = maxX - minX + 1
  const cropHeight = maxY - minY + 1
  const tightMark = await sharp(cleaned, {
    raw: { width, height, channels: 4 },
  })
    .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
    .resize({ width: 1024 })
    .png()
    .toBuffer()

  await ensureOutput(cleanMarkPath)
  await sharp(tightMark).png().toFile(cleanMarkPath)

  const extracted = await sharp(tightMark)
    .resize(800, 800, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  const extractedMeta = await sharp(extracted).metadata()
  const targetSize = 1024

  await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: extracted,
        left: Math.round(
          (targetSize - (extractedMeta.width ?? targetSize)) / 2,
        ),
        top: Math.round(
          (targetSize - (extractedMeta.height ?? targetSize)) / 2,
        ),
      },
    ])
    .png()
    .toFile(preparedSourcePath)
}

async function runPwaAssetGenerator(args) {
  await execFileAsync('pwa-asset-generator', args, {
    cwd: root,
    maxBuffer: 1024 * 1024 * 10,
  })
}

async function createFaviconIco(sourcePath) {
  const sizes = [16, 32, 48]
  const pngs = await Promise.all(
    sizes.map((size) =>
      sharp(sourcePath).resize(size, size, { fit: 'contain' }).png().toBuffer(),
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
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(bytes.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += bytes.length
    return entry
  })

  await writeFile(
    join(pwaPublic, 'favicon.ico'),
    Buffer.concat([header, ...entries, ...pngs]),
  )
}

async function writePngFromImage(imagePath, outPath, width) {
  await ensureOutput(outPath)
  await sharp(imagePath).resize({ width }).png().toFile(outPath)
}

async function copyGeneratedPwaIcons() {
  await copyFile(
    join(tempDir, 'apple-icon-180.png'),
    join(pwaPublic, 'apple-touch-icon.png'),
  )
  await copyFile(
    join(tempDir, 'manifest-icon-192.maskable.png'),
    join(iconsDir, 'icon-192x192.png'),
  )
  await copyFile(
    join(tempDir, 'manifest-icon-192.maskable.png'),
    join(iconsDir, 'icon-maskable-192x192.png'),
  )
  await copyFile(
    join(tempDir, 'manifest-icon-512.maskable.png'),
    join(iconsDir, 'icon-512x512.png'),
  )
  await copyFile(
    join(tempDir, 'manifest-icon-512.maskable.png'),
    join(iconsDir, 'icon-maskable-512x512.png'),
  )
  await copyFile(
    join(tempDir, 'favicon-196.png'),
    join(pwaPublic, 'favicon-196x196.png'),
  )

  const baseIcon = join(tempDir, 'manifest-icon-512.maskable.png')
  for (const size of legacyIconSizes) {
    await sharp(baseIcon)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-${size}x${size}.png`))
  }

  await sharp(baseIcon)
    .resize(16, 16)
    .png()
    .toFile(join(pwaPublic, 'favicon-16x16.png'))
  await sharp(baseIcon)
    .resize(32, 32)
    .png()
    .toFile(join(pwaPublic, 'favicon-32x32.png'))
  await sharp(baseIcon)
    .resize(1024, 1024)
    .png()
    .toFile(join(pwaPublic, 'icon-base.png'))
  await sharp(baseIcon)
    .resize(32, 32)
    .png()
    .toFile(join(pwaPublic, 'icon-light-32x32.png'))
  await sharp(baseIcon)
    .resize(32, 32)
    .png()
    .toFile(join(pwaPublic, 'icon-dark-32x32.png'))
  await createFaviconIco(baseIcon)
}

async function copyGeneratedSplashImages() {
  const filenames = await readdir(tempDir)
  await mkdir(iconsDir, { recursive: true })

  for (const filename of filenames) {
    if (!filename.startsWith('apple-splash-') || !filename.endsWith('.png'))
      continue
    await copyFile(join(tempDir, filename), join(iconsDir, filename))
  }
}

async function removeLegacySplashImages() {
  const filenames = await readdir(iconsDir)
  await Promise.all(
    filenames
      .filter(
        (filename) =>
          filename.startsWith('splash-') && filename.endsWith('.png'),
      )
      .map((filename) => rm(join(iconsDir, filename), { force: true })),
  )
}

async function main() {
  await rm(tempDir, { recursive: true, force: true })
  await mkdir(tempDir, { recursive: true })
  await mkdir(iconsDir, { recursive: true })

  await prepareCleanMark()
  await runPwaAssetGenerator([
    preparedSourcePath,
    tempDir,
    '--icon-only',
    '--favicon',
    '--type',
    'png',
    '--background',
    '#f8eff0',
    '--padding',
    '0%',
    '--opaque',
    'true',
    '--scrape',
    'false',
    '--log',
    'false',
  ])

  await runPwaAssetGenerator([
    preparedSourcePath,
    tempDir,
    '--splash-only',
    '--portrait-only',
    '--type',
    'png',
    '--background',
    '#f8eff0',
    '--padding',
    'calc(50vh - 17%) calc(50vw - 30%)',
    '--opaque',
    'true',
    '--scrape',
    'false',
    '--log',
    'false',
  ])

  await copyGeneratedPwaIcons()
  await removeLegacySplashImages()
  await copyGeneratedSplashImages()
  const logoOut = join(pwaPublic, 'logo.png')
  const logoCleanOut = join(brandDir, 'saloora-logo-clean.png')
  await writePngFromImage(cleanMarkPath, logoOut, 1024)
  await writePngFromImage(cleanMarkPath, logoCleanOut, 512)
  await copyFile(
    cleanMarkPath,
    join(root, 'apps/web/public/landing/saloora-mark.png'),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
