#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import { technicalSession } from './technical-session.mjs'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'

const [directory] = process.argv.slice(2)
assert(
  directory && resolve(directory) === directory,
  'Use an absolute private directory',
)
const base = 'http://localhost:3301'
const articles = JSON.parse(
  await readFile(
    new URL('../../content/blog-launch/articles.json', import.meta.url),
    'utf8',
  ),
)
const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
await client.connect()
const inventory = await client.listArticles()
assert.equal(
  inventory.filter((item) =>
    articles.some((article) => article.slug === item.slug),
  ).length,
  3,
  'Exactly three saved launch drafts required',
)
const batch = await readPrivateJson(resolve(directory, 'launch-batch.json'))
assert.equal(batch.batch, 'BL-0099')
assert.equal(
  new Set(Object.values(batch.articles).map((article) => article.id)).size,
  3,
)
const statePath = resolve(directory, 'browser-state.json')
let session, page
try {
  session = await technicalSession(statePath, 'editor')
  page = session.page
  const probes = {
    'staff-commission': [
      '۲۴۰٬۰۰۰',
      '۱۲۰٬۰۰۰',
      '۶۴۰٬۰۰۰',
      '۳۲۰٬۰۰۰',
      '۵۰ درصد از مبنای ۶۰۰٬۰۰۰ تومانی، ۳۰۰٬۰۰۰',
      'سود خالص نیست',
      'خودکار ایجاد نمی‌کند',
    ],
    'appointment-requests': [
      'جای خالی را رزرو نمی‌کند',
      'شروع',
      'پیش از ساعت ۱۷',
      '۹۰ روز',
      'اعتبارسنجی ایجاد نوبت دوباره انجام می‌شود',
    ],
    'client-records': [
      'نام و شماره تماس لازم‌اند',
      'تاریخ تولد کامل و اختیاری',
      'ارسال خودکار پیام نیست',
      'تا هشت برچسب',
      'پیگیری‌های',
    ],
  }
  for (const article of articles) {
    const delivered = batch.articles[article.key]
    const { item } = await client.getArticle(delivered.id)
    assert.equal(item.status, 'draft')
    assert(!item.liveRevisionId && !item.scheduledAt)
    assert.equal(item.slug, article.slug)
    assert.equal(item.locale, 'en')
    assert(
      Array.isArray(item.data.body) &&
        item.data.body.some((block) => block.style === 'h2'),
      'Saved rich text required',
    )
    assert([false, 0].includes(item.data.search_excluded))
    const response = await page.goto(delivered.url)
    assert.equal(response.status(), 200)
    assert.match(response.headers()['cache-control'], /private.*no-store/)
    assert.match(response.headers()['x-robots-tag'], /noindex/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      article.title,
    )
    await expect(page.getByText('تیم سالونا', { exact: true })).toBeVisible()
    assert((await page.title()).includes(article.seo_title))
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      article.seo_description,
    )
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    )
    await expect(
      page.locator('article a[href="https://app.saluna.ir/signup"]'),
    ).toHaveCount(2)
    await expect(
      page.getByRole('link', { name: 'شروع استفاده از سالونا', exact: true }),
    ).toHaveAttribute('href', 'https://app.saluna.ir/signup')
    for (const text of probes[article.key])
      await expect(page.locator('article')).toContainText(text)
    const social = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content')
    assert.equal(new URL(social).pathname, '/og/landing.png')
    assert.equal((await fetch(social)).status, 200)
    assert.equal((await fetch(delivered.url)).status, 403)
    assert.equal((await fetch(`${base}/blog/${article.slug}`)).status, 404)
    for (const path of ['/blog', '/blog-sitemap.xml']) {
      const publicResponse = await fetch(`${base}${path}`)
      assert.equal(publicResponse.status, 200)
      assert(!(await publicResponse.text()).includes(article.slug))
    }
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.screenshot({
      path: resolve(directory, `launch-${article.key}.png`),
      fullPage: true,
    })
    if (article.key === 'staff-commission') {
      await page.setViewportSize({ width: 390, height: 844 })
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        'Commission examples must fit a mobile viewport',
      )
      await page.screenshot({
        path: resolve(directory, 'launch-staff-commission-mobile.png'),
        fullPage: true,
      })
      await page
        .getByRole('heading', {
          name: 'مثال دوم: دو نفر با سهم کار و درصد متفاوت',
          exact: true,
        })
        .scrollIntoViewIfNeeded()
      await page.screenshot({
        path: resolve(directory, 'launch-commission-example-mobile.png'),
      })
      await page.setViewportSize({ width: 1280, height: 1000 })
    }
    await page.goto(`/_emdash/admin/content/blog_articles/${item.id}`)
    await expect(page.getByLabel('عنوان', { exact: true })).toHaveValue(
      article.title,
    )
    await page.goto('/_emdash/admin')
    console.log(
      `PASS launch ${article.key}: saved rich draft, Editor preview/SEO/team/signup, public absence`,
    )
  }
  await writePrivateJson(resolve(directory, 'launch-verification.json'), {
    verifiedAt: new Date().toISOString(),
    batch: 'BL-0099',
    drafts: articles.map((article) => ({
      key: article.key,
      id: batch.articles[article.key].id,
      slug: article.slug,
      status: 'draft',
    })),
    humanTrial: 'pending',
  })
} catch (error) {
  await page
    ?.screenshot({
      path: resolve(directory, 'launch-failure.png'),
      fullPage: true,
    })
    .catch(() => {})
  throw new Error(
    error.message
      .replace(/([?&]_preview=)[^&\s]+/g, '$1[redacted]')
      .replace(/ec_[A-Za-z0-9_-]+/g, '[redacted]'),
  )
} finally {
  await session?.close()
}
