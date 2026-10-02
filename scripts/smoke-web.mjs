#!/usr/bin/env node
/**
 * Smoke checks for @repo/web (Astro public site).
 *
 * Usage:
 *   node scripts/smoke-web.mjs
 *   BASE_URL=http://127.0.0.1:3001 node scripts/smoke-web.mjs
 *   BASE_URL=http://127.0.0.1:3001 SLUG=my-salon node scripts/smoke-web.mjs
 *   SLUG=saluna MANAGER_PHONE=09120000000 MANAGER_PASSWORD=admin123 node scripts/smoke-web.mjs
 */
import sharp from 'sharp'

const base = (process.env.BASE_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
)
const apiBase = (process.env.API_URL ?? 'http://localhost:3002').replace(
  /\/$/,
  '',
)
const slug = process.env.SLUG
const unpublishedSlug = process.env.UNPUBLISHED_SLUG
const requestToken = process.env.REQUEST_TOKEN
const managerPhone = process.env.MANAGER_PHONE
const managerPassword = process.env.MANAGER_PASSWORD
let cacheBust = 0

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

/** @param {string} path */
function uncached(path) {
  const separator = path.includes('?') ? '&' : '?'
  return get(`${path}${separator}smoke=${Date.now()}-${cacheBust++}`, {
    cache: 'no-store',
  })
}

/** @param {string} html */
function canonicalFrom(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? ''
}

/** @param {string} html */
function beautySalonFrom(html) {
  for (const match of html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
  )) {
    const value = JSON.parse(match[1])
    if (value?.['@type'] === 'BeautySalon') return value
  }
  return null
}

/** @param {string} xml */
function isSitemapXml(xml) {
  const compact = xml.replace(/\s+/g, ' ').trim()
  if (
    !compact.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
    !compact.includes(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ) ||
    !compact.endsWith('</urlset>')
  ) {
    return false
  }
  const urls = compact.match(/<url><loc>[^<>]+<\/loc><\/url>/g) ?? []
  return (
    (compact.match(/<url>/g) ?? []).length === urls.length &&
    (compact.match(/<\/url>/g) ?? []).length === urls.length
  )
}

async function checkPublicSeo(landingHtml) {
  const paths = [
    '/services',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/features/online-appointment-requests',
    '/features/salon-clients',
    '/features/staff-commission',
  ]
  const { text: sitemap } = await get('/sitemap-0.xml')
  const titles = new Set()
  for (const path of paths) {
    const { res, text } = await get(path)
    const canonical = canonicalFrom(text)
    const title = text.match(/<title>(.*?)<\/title>/s)?.[1]
    if (
      res.status === 200 &&
      canonical &&
      new URL(canonical).pathname === path &&
      !text.includes('content="noindex')
    ) {
      pass(`${path} is indexable with its canonical path`)
    } else fail(`${path} public metadata`, `${res.status}, ${canonical}`)
    if (title && !titles.has(title)) titles.add(title)
    else fail(`${path} missing or duplicate title`)
    if ((text.match(/<h1\b/g) ?? []).length === 1) pass(`${path} has one H1`)
    else fail(`${path} H1 count`)
    if (landingHtml.includes(`href="${path}"`))
      pass(`homepage links to ${path}`)
    else fail(`homepage missing link to ${path}`)
    if (sitemap.includes(`<loc>${canonical}</loc>`))
      pass(`${path} canonical appears in sitemap`)
    else fail(`${path} canonical missing from sitemap`)
    const redirect = await fetch(`${base}${path}/?campaign=seo%20check`, {
      redirect: 'manual',
    })
    const location = redirect.headers.get('location')
    const target = location ? new URL(location, base) : null
    if (
      [301, 308].includes(redirect.status) &&
      target?.pathname === path &&
      target.search === '?campaign=seo%20check'
    ) {
      pass(`${path}/ redirects and preserves query`)
    } else fail(`${path}/ redirect`, `${redirect.status}, ${location}`)
  }

  const faq = [
    ...landingHtml.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
    ),
  ]
    .map((match) => JSON.parse(match[1]))
    .find((item) => item['@type'] === 'FAQPage')
  const visibleText = landingHtml
    .replace(/<script\b[^>]*>.*?<\/script>/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
  if (
    faq?.mainEntity?.length &&
    faq.mainEntity.every(
      (item) =>
        visibleText.includes(item.name) &&
        visibleText.includes(item.acceptedAnswer.text),
    )
  ) {
    pass('homepage FAQ schema matches readable questions and answers')
  } else fail('homepage FAQ schema differs from page content')

  for (const [path, type, width, height] of [
    ['/og/landing.png', 'png', 1200, 630],
    ['/apple-touch-icon.png', 'png', 180, 180],
    ['/landing/saluna-mark-88.webp', 'webp', 88, 88],
  ]) {
    const response = await fetch(`${base}${path}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const info = await sharp(bytes).metadata()
    if (
      response.status === 200 &&
      info.format === type &&
      info.width === width &&
      info.height === height
    )
      pass(`${path} is a valid ${width}×${height} ${type}`)
    else
      fail(
        `${path} image response`,
        `${response.status}, ${info.width}×${info.height}`,
      )
    if (type === 'webp' && bytes.length >= 10_000)
      fail('header mark exceeds 10 KB', bytes.length)
  }
  if (
    landingHtml.includes(
      'rel="icon" type="image/png" sizes="180x180" href="/apple-touch-icon.png"',
    )
  )
    pass('homepage declares the stable 180px icon')
  else fail('homepage primary icon declaration')
  const preloads =
    landingHtml.match(/<link[^>]+rel="preload"[^>]+as="font"[^>]*>/g) ?? []
  if (preloads.length === 3) pass('homepage preloads three selected fonts')
  else fail('homepage font preload count', preloads.length)
}

async function signInManager() {
  const response = await fetch(`${apiBase}/api/v1/auth/sign-in/phone-number`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: managerPhone,
      password: managerPassword,
    }),
  })
  if (!response.ok) {
    throw new Error(`Manager sign-in failed (${response.status})`)
  }
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ')
  if (!cookie) throw new Error('Manager sign-in returned no session cookie')
  return cookie
}

async function managerRequest(cookie, path, method = 'GET', body) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status})`)
  }
  return response.json()
}

async function checkPublishedSalon(salonSlug) {
  const salonPath = `/salons/${salonSlug}`
  const { res, text } = await uncached(salonPath)
  if (res.status !== 200) fail(`GET ${salonPath}`, String(res.status))
  else pass(`GET ${salonPath} → ${res.status}`)

  const cache = header(res, 'cache-control')
  if (cache.includes('s-maxage=300')) pass('salon Cache-Control s-maxage=300')
  else fail('salon cache header', cache || '(missing)')

  const canonical = canonicalFrom(text)
  let canonicalUrl
  try {
    canonicalUrl = new URL(canonical)
  } catch {
    fail('salon canonical URL', canonical || '(missing)')
  }
  if (canonicalUrl && !canonicalUrl.search && !canonicalUrl.hash) {
    pass('salon canonical excludes query and fragment')
  } else if (canonicalUrl) {
    fail('salon canonical includes query or fragment', canonical)
  }

  const schema = beautySalonFrom(text)
  if (schema) pass('salon BeautySalon JSON-LD')
  else fail('salon BeautySalon JSON-LD missing')

  if (schema?.address?.['@type'] === 'PostalAddress') {
    pass('salon JSON-LD has PostalAddress')
  } else {
    fail('salon JSON-LD PostalAddress missing')
  }
  if (
    Array.isArray(schema?.openingHoursSpecification) &&
    schema.openingHoursSpecification.length > 0
  ) {
    pass('salon JSON-LD has openingHoursSpecification')
  } else {
    fail('salon JSON-LD openingHoursSpecification missing')
  }

  const visibleHtml = text.replace(/<script\b[^>]*>.*?<\/script>/gs, '')
  const locality = [
    schema?.address?.addressRegion,
    schema?.address?.addressLocality,
  ]
    .filter(Boolean)
    .every((value) => visibleHtml.includes(value))
  if (locality) pass('salon renders its locality')
  else fail('salon visible locality missing')
  if (visibleHtml.includes('روزهای کاری:') && visibleHtml.includes('ساعت')) {
    pass('salon renders working days and hours')
  } else {
    fail('salon visible working hours missing')
  }

  const { res: sitemapRes, text: sitemap } = await uncached(
    '/salons-sitemap.xml',
  )
  if (sitemapRes.status !== 200) {
    fail('GET /salons-sitemap.xml', String(sitemapRes.status))
  } else {
    pass(`GET /salons-sitemap.xml → ${sitemapRes.status}`)
  }
  if (isSitemapXml(sitemap)) pass('Salon sitemap is valid XML')
  else fail('Salon sitemap XML')
  const sitemapCache = header(sitemapRes, 'cache-control')
  if (sitemapCache === 'public, s-maxage=86400, stale-while-revalidate=3600') {
    pass('Salon sitemap Cache-Control')
  } else {
    fail('Salon sitemap cache header', sitemapCache || '(missing)')
  }
  if (canonical && sitemap.includes(`<loc>${canonical}</loc>`)) {
    pass('Salon sitemap contains canonical URL')
  } else {
    fail('Salon sitemap canonical URL missing', canonical)
  }

  return canonical
}

async function checkUnpublishedSalon(salonSlug, canonical) {
  const salonPath = `/salons/${salonSlug}`
  const [{ res }, { text: sitemap }] = await Promise.all([
    uncached(salonPath),
    uncached('/salons-sitemap.xml'),
  ])
  if (res.status === 404) pass(`unpublished ${salonPath} → 404`)
  else fail(`unpublished ${salonPath} status`, String(res.status))

  const location = canonical ? `<loc>${canonical}</loc>` : `${salonPath}</loc>`
  if (!sitemap.includes(location)) {
    pass('unpublished Salon absent from sitemap')
  } else {
    fail('unpublished Salon remains in sitemap', location)
  }
}

async function main() {
  if (Boolean(managerPhone) !== Boolean(managerPassword)) {
    throw new Error('Set both MANAGER_PHONE and MANAGER_PASSWORD')
  }

  console.log(`Smoke testing ${base}\n`)

  {
    const { res, text } = await get('/')
    if (res.status !== 200) fail('GET /', String(res.status))
    else pass(`GET / → ${res.status}`)
    if (!text.includes('lang="fa"')) fail('landing lang=fa')
    else pass('landing has lang="fa"')
    if (!text.includes('سالونا')) fail('landing title copy')
    else pass('landing Persian copy present')
    if (
      header(res, 'content-security-policy') ||
      text.includes('http-equiv="content-security-policy"')
    ) {
      pass('landing has CSP')
    } else {
      fail('landing missing CSP')
    }
    await checkPublicSeo(text)
  }

  {
    const { res, text } = await get('/robots.txt')
    if (res.status !== 200) fail('GET /robots.txt', String(res.status))
    else pass(`GET /robots.txt → ${res.status}`)
    if (
      text.includes('/sitemap-index.xml') &&
      text.includes('/salons-sitemap.xml')
    ) {
      pass('robots.txt references static and Salon sitemaps')
    } else {
      fail('robots.txt sitemap declarations')
    }
  }

  {
    const { res, text } = await get('/sitemap-index.xml')
    if (res.status !== 200) fail('GET /sitemap-index.xml', String(res.status))
    else pass(`GET /sitemap-index.xml → ${res.status}`)
    if (!text.includes('<sitemapindex')) fail('sitemap-index XML')
    else pass('sitemap-index is XML')
  }

  if (slug) {
    let cookie
    let originalSettings
    let originalPresence
    try {
      if (managerPhone) {
        cookie = await signInManager()
        originalSettings = await managerRequest(
          cookie,
          '/api/v1/salon-public-settings',
        )
        originalPresence = await managerRequest(
          cookie,
          '/api/v1/salon-profile/presence',
        )
        if (originalSettings.slug !== slug) {
          throw new Error(
            `Manager Salon slug is ${originalSettings.slug}, not ${slug}`,
          )
        }
        await managerRequest(
          cookie,
          '/api/v1/salon-profile/presence',
          'PATCH',
          {
            province: 'تهران',
            city: 'تهران',
            neighborhood: 'سعادت‌آباد',
            address: 'خیابان سرو غربی، پلاک ۱۰',
          },
        )
        await managerRequest(cookie, '/api/v1/salon-public-settings', 'PUT', {
          enabled: true,
        })
      }

      const canonical = await checkPublishedSalon(slug)

      const { res: ogRes } = await get(`/og/${slug}.png`, { method: 'HEAD' })
      if (ogRes.status !== 200) {
        fail(`HEAD /og/${slug}.png`, String(ogRes.status))
      } else {
        pass(`HEAD /og/${slug}.png → ${ogRes.status}`)
      }
      if ((ogRes.headers.get('content-type') ?? '').includes('image/png')) {
        pass('OG content-type image/png')
      } else {
        fail('OG content-type', ogRes.headers.get('content-type') ?? '')
      }

      if (requestToken) {
        const reqPath = `/salons/${slug}/requests/${requestToken}`
        const { res: reqRes, text: reqText } = await uncached(reqPath)
        if (reqRes.status !== 200) fail(`GET ${reqPath}`, String(reqRes.status))
        else pass(`GET ${reqPath} → ${reqRes.status}`)
        const reqCache = header(reqRes, 'cache-control')
        if (reqCache.includes('no-store')) {
          pass('request page Cache-Control no-store')
        } else {
          fail('request cache header', reqCache || '(missing)')
        }
        if (
          /<meta name="robots" content="[^"]*noindex[^"]*nofollow[^"]*"/.test(
            reqText,
          )
        ) {
          pass('request page is noindex, nofollow')
        } else {
          fail('request page robots directives')
        }
      }

      if (cookie) {
        await managerRequest(cookie, '/api/v1/salon-public-settings', 'PUT', {
          enabled: false,
        })
        await checkUnpublishedSalon(slug, canonical)
        await managerRequest(cookie, '/api/v1/salon-public-settings', 'PUT', {
          enabled: true,
        })
        const { text: sitemap } = await uncached('/salons-sitemap.xml')
        if (sitemap.includes(`<loc>${canonical}</loc>`)) {
          pass('newly enabled Salon appears without rebuilding')
        } else {
          fail('newly enabled Salon missing from uncached sitemap')
        }
      } else if (unpublishedSlug) {
        await checkUnpublishedSalon(unpublishedSlug)
      } else {
        console.log(
          '\n(skip publication-state journey: set manager credentials or UNPUBLISHED_SLUG)',
        )
      }
    } finally {
      if (cookie && originalSettings && originalPresence) {
        await managerRequest(
          cookie,
          '/api/v1/salon-profile/presence',
          'PATCH',
          originalPresence.presence,
        )
        await managerRequest(cookie, '/api/v1/salon-public-settings', 'PUT', {
          enabled: originalSettings.settings.enabled,
        })
      }
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
