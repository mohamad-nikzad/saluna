import type { APIRoute } from 'astro'
import { brand } from '@repo/brand'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const prerender = false

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontPath = path.resolve(
  __dirname,
  '../../assets/fonts/Vazirmatn-Bold.ttf',
)

let vazirmatn: Buffer | null = null

async function loadFont() {
  if (vazirmatn) return vazirmatn
  try {
    vazirmatn = await fs.readFile(fontPath)
    return vazirmatn
  } catch {
    return null
  }
}

export const GET: APIRoute = async () => {
  const font = await loadFont()
  const fontFamily = font ? 'Vazirmatn' : 'sans-serif'

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background:
            'linear-gradient(135deg, #fdf5f8 0%, #ffe5ec 44%, #f8c8d5 100%)',
          color: '#3f2730',
          direction: 'rtl',
          fontFamily,
          position: 'relative',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                left: 72,
                top: 70,
                width: 190,
                height: 190,
                borderRadius: 54,
                background: 'rgba(255, 255, 255, 0.52)',
                border: '2px solid rgba(122, 42, 64, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'rotate(-8deg)',
              },
              children: {
                type: 'div',
                props: {
                  style: {
                    fontSize: 98,
                    lineHeight: 1,
                    color: '#9b2f4a',
                    transform: 'rotate(8deg)',
                  },
                  children: 'س',
                },
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 22,
                maxWidth: 820,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 22px',
                      borderRadius: 999,
                      background: 'rgba(255, 255, 255, 0.72)',
                      color: '#7a2a40',
                      fontSize: 28,
                    },
                    children: 'دسترسی آزمایشی رایگان',
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 82,
                      lineHeight: 1.18,
                      letterSpacing: 0,
                      color: '#4a1e2e',
                    },
                    children: `${brand.name.fa}؛ نرم‌افزار مدیریت سالن زیبایی`,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: 34,
                      lineHeight: 1.75,
                      color: '#6b4955',
                      maxWidth: 760,
                    },
                    children:
                      'نوبت‌ها، مشتریان، پرسنل، خدمات، صفحه عمومی سالن و درخواست نوبت با تایید مدیر.',
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                color: '#7a2a40',
                fontSize: 28,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      gap: 12,
                    },
                    children: [
                      'مدیریت نوبت سالن',
                      'صفحه عمومی سالن',
                      'پلن‌ها به‌زودی',
                    ].map((item) => ({
                      type: 'div',
                      props: {
                        style: {
                          padding: '10px 18px',
                          borderRadius: 999,
                          background: 'rgba(255, 255, 255, 0.64)',
                        },
                        children: item,
                      },
                    })),
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      color: '#9b2f4a',
                    },
                    children: brand.name.en,
                  },
                },
              ],
            },
          },
        ],
      },
    } as Parameters<typeof satori>[0],
    {
      width: 1200,
      height: 630,
      fonts: font
        ? [{ name: 'Vazirmatn', data: font, weight: 800, style: 'normal' }]
        : [],
    },
  )

  const png = new Resvg(svg).render().asPng()

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control':
        'public, s-maxage=86400, stale-while-revalidate=604800, immutable',
    },
  })
}
