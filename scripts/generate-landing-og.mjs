import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { brand } from '../packages/brand/src/config.ts'

const outputDir = new URL('../apps/web/public/og/', import.meta.url)
const fontfile = fileURLToPath(
  new URL('../apps/web/src/assets/fonts/Vazirmatn-Bold.ttf', import.meta.url),
)
const width = 1200
const height = 630
const background =
  Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="rose" x2="1" y2="1"><stop stop-color="#fdf5f8"/><stop offset="1" stop-color="#f8c8d5"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#rose)"/>
  <rect x="32" y="32" width="1136" height="566" rx="36" fill="none" stroke="#d68aa0"/>
  <rect x="380" y="454" width="440" height="72" rx="36" fill="#4a1e2e"/>
</svg>`)

async function textLayer(text, size, color, top) {
  // Pango shapes Persian and orders RTL text before compositing it as pixels.
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${text}</span>`,
      font: `Vazirmatn Bold ${size}`,
      fontfile,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })
  if (info.width > width - 120 || top + info.height > height - 40) {
    throw new Error(`Landing preview text does not fit: ${text}`)
  }
  return { input: data, left: Math.round((width - info.width) / 2), top }
}

await mkdir(outputDir, { recursive: true })
const layers = await Promise.all([
  textLayer(brand.name.fa, 104, '#9b2f4a', 92),
  textLayer('نرم‌افزار مدیریت سالن زیبایی', 54, '#4a1e2e', 255),
  textLayer('نوبت‌ها، مشتریان و برنامه پرسنل در یک جا', 32, '#6b4955', 365),
  textLayer('درخواست نوبت با تأیید مدیر', 30, '#ffffff', 475),
  textLayer(brand.domains.public, 24, '#7a2a40', 553),
])
await sharp(background)
  .composite(layers)
  .png()
  .toFile(fileURLToPath(new URL('landing.png', outputDir)))
console.log('Generated apps/web/public/og/landing.png (1200×630)')
