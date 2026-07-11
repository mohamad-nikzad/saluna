#!/usr/bin/env node
/**
 * Smoke checks for @repo/web (Astro public site).
 *
 * Usage:
 *   node scripts/smoke-web.mjs
 *   BASE_URL=http://127.0.0.1:3001 node scripts/smoke-web.mjs
 *   BASE_URL=http://127.0.0.1:3001 SLUG=my-salon node scripts/smoke-web.mjs
 */
const base = (process.env.BASE_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
)
const slug = process.env.SLUG
const requestToken = process.env.REQUEST_TOKEN

/** @param {string} label */
function pass(label) {
  console.log(`✓ ${label}`)
}

/** @param {string} label */
function fail(label, detail) {
  console.error(`✗ ${label}${detail ? `: ${detail}` : ''}`)
  process.exitCode = 1
}

/** @param {Response} res */
function header(res, name) {
  return res.headers.get(name) ?? ''
}

/** @param {string} path */
async function get(path, options = {}) {
  const url = `${base}${path}`
  const res = await fetch(url, { redirect: 'follow', ...options })
  const text = await res.text()
  return { res, text, url }
}

async function main() {
  console.log(`Smoke testing ${base}\n`)

  {
    const { res, text } = await get('/')
    if (res.status !== 200) fail('GET /', String(res.status))
    else pass(`GET / → ${res.status}`)
    if (!text.includes('lang="fa"')) fail('landing lang=fa')
    else pass('landing has lang="fa"')
    if (!text.includes('سالونا')) fail('landing title copy')
    else pass('landing Persian copy present')
    if (header(res, 'content-security-policy')) pass('landing has CSP header')
    else fail('landing missing CSP header')
  }

  {
    const { res, text } = await get('/robots.txt')
    if (res.status !== 200) fail('GET /robots.txt', String(res.status))
    else pass(`GET /robots.txt → ${res.status}`)
    if (!text.includes('Sitemap:')) fail('robots.txt sitemap line')
    else pass('robots.txt references sitemap')
  }

  {
    const { res, text } = await get('/sitemap-index.xml')
    if (res.status !== 200) fail('GET /sitemap-index.xml', String(res.status))
    else pass(`GET /sitemap-index.xml → ${res.status}`)
    if (!text.includes('<sitemapindex')) fail('sitemap-index XML')
    else pass('sitemap-index is XML')
  }

  if (slug) {
    const salonPath = `/salons/${slug}`
    const { res, text } = await get(salonPath)
    if (res.status !== 200) fail(`GET ${salonPath}`, String(res.status))
    else pass(`GET ${salonPath} → ${res.status}`)

    const cache = header(res, 'cache-control')
    if (cache.includes('s-maxage=300')) pass('salon Cache-Control s-maxage=300')
    else fail('salon cache header', cache || '(missing)')

    if (text.includes('application/ld+json')) pass('salon JSON-LD in HTML')
    else fail('salon JSON-LD missing')

    if (text.includes('BeautySalon')) pass('salon BeautySalon schema')
    else fail('salon BeautySalon schema missing')

    const { res: ogRes } = await get(`/og/${slug}.png`, { method: 'HEAD' })
    if (ogRes.status !== 200) fail(`HEAD /og/${slug}.png`, String(ogRes.status))
    else pass(`HEAD /og/${slug}.png → ${ogRes.status}`)
    if ((ogRes.headers.get('content-type') ?? '').includes('image/png')) {
      pass('OG content-type image/png')
    } else {
      fail('OG content-type', ogRes.headers.get('content-type') ?? '')
    }

    if (requestToken) {
      const reqPath = `/salons/${slug}/requests/${requestToken}`
      const { res: reqRes } = await get(reqPath)
      if (reqRes.status !== 200) fail(`GET ${reqPath}`, String(reqRes.status))
      else pass(`GET ${reqPath} → ${reqRes.status}`)
      const reqCache = header(reqRes, 'cache-control')
      if (reqCache.includes('no-store'))
        pass('request page Cache-Control no-store')
      else fail('request cache header', reqCache || '(missing)')
    }
  } else {
    console.log(
      '\n(skip salon checks: set SLUG=your-salon-slug to test booking routes)',
    )
  }

  {
    const { res } = await get('/salons/__missing-slug-smoke__')
    if (res.status === 404) pass('missing salon → 404')
    else fail('missing salon status', String(res.status))
  }

  console.log(
    process.exitCode ? '\nSome checks failed.' : '\nAll checks passed.',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
