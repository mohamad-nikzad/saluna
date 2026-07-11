import type { APIRoute } from 'astro'
import { brand } from '@repo/brand'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { fetchPublicSalon, PublicApiError } from '@/lib/public-api'
import { resolvePublicTheme } from '@repo/salon-core/public-themes'
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

function monogram(name: string): string {
  return Array.from(name.trim())[0] ?? 'س'
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug
  if (!slug) {
    return new Response('Not found', { status: 404 })
  }

  let view
  try {
    view = await fetchPublicSalon(slug)
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) {
      return new Response(null, { status: 404 })
    }
    throw e
  }

  const theme = resolvePublicTheme(view.publicSettings.themeId)
  const font = await loadFont()

  const svg = await satori(
    {
      type: 'div',
      // satori element tree (not React JSX)
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '64px',
          background: `linear-gradient(135deg, ${theme.swatch} 0%, #fdf5f8 100%)`,
          fontFamily: font ? 'Vazirmatn' : 'sans-serif',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 48,
                fontWeight: 700,
                color: theme.primary,
                marginBottom: 24,
              },
              children: monogram(view.salon.name),
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 72,
                fontWeight: 700,
                color: '#3f2730',
                lineHeight: 1.2,
              },
              children: view.salon.name,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 32,
                color: '#6b4955',
                marginTop: 16,
              },
              children: brand.name.fa,
            },
          },
        ],
      },
    } as Parameters<typeof satori>[0],
    {
      width: 1200,
      height: 630,
      fonts: font
        ? [{ name: 'Vazirmatn', data: font, weight: 700, style: 'normal' }]
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
