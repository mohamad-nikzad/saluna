import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRobotsTxt } from './robots'

vi.mock('astro:env/client', () => ({
  PUBLIC_API_URL: 'https://api.example.test',
  PUBLIC_APP_URL: 'https://saluna.example.test/path?ignored=true',
}))

import { GET } from '../pages/salons-sitemap.xml'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime Salon sitemap', () => {
  it('returns canonical published Salon URLs as cached XML', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ slugs: ['aftab', 'rose'] }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetch)

    const response = await GET({} as never)

    expect(fetch.mock.calls[0]![0].toString()).toBe(
      'https://api.example.test/api/v1/public/salons',
    )
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=86400, stale-while-revalidate=3600',
    )
    expect(response.headers.get('Content-Type')).toBe(
      'application/xml; charset=utf-8',
    )
    expect(await response.text()).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://saluna.example.test/salons/aftab</loc></url>
  <url><loc>https://saluna.example.test/salons/rose</loc></url>
</urlset>
`)
  })

  it('excludes only owner-confirmed internal Salons from discovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              slugs: [
                'salon-a027zt',
                'salon-vubbcn',
                'salon-gzwp7u',
                'aravirabeautylounge',
                'mehrnanail',
                'salon-wizjyw',
              ],
            }),
          ),
        ),
    )

    const xml = await (await GET({} as never)).text()
    for (const slug of ['salon-a027zt', 'salon-vubbcn', 'salon-gzwp7u']) {
      expect(xml).not.toContain(`/salons/${slug}`)
    }
    for (const slug of ['aravirabeautylounge', 'mehrnanail', 'salon-wizjyw']) {
      expect(xml).toContain(`/salons/${slug}`)
    }
  })

  it('reads current publication state for every uncached response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ slugs: ['aftab'] })),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ slugs: [] }))),
    )

    expect(await (await GET({} as never)).text()).toContain('/salons/aftab')
    expect(await (await GET({} as never)).text()).not.toContain('/salons/aftab')
  })

  it('declares both static and runtime sitemaps in robots.txt', async () => {
    const expected = `User-agent: *
Allow: /

Sitemap: https://saluna.example.test/sitemap-index.xml
Sitemap: https://saluna.example.test/salons-sitemap.xml
`

    expect(
      buildRobotsTxt('https://saluna.example.test/path?ignored=true'),
    ).toBe(expected)
    const devRobots = await readFile(
      new URL('../../public/robots.txt', import.meta.url),
      'utf8',
    )
    expect(devRobots).toContain(
      'Sitemap: http://localhost:3001/sitemap-index.xml',
    )
    expect(devRobots).toContain(
      'Sitemap: http://localhost:3001/salons-sitemap.xml',
    )
  })
})
