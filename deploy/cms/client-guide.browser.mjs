import assert from 'node:assert/strict'
import { readFile, writeFile, chmod } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import sharp from 'sharp'
import { technicalSession } from './technical-session.mjs'
import { configureCmsBlog } from '../../scripts/configure-cms-blog.mjs'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'
import {
  checkGuideDiscovery,
  checkProductGuide,
} from '../../scripts/smoke-blog.mjs'

// Explicit one-time local example delivery. Verify is read-only; reopening
// never replaces CMS edits or republishes an already delivered guide.
const [mode, directory] = process.argv.slice(2)
assert(['configure', 'publish', 'verify'].includes(mode))
assert(directory && resolve(directory) === directory)
const repository = resolve(new URL('../..', import.meta.url).pathname)
assert(
  !directory.startsWith(repository + '/'),
  'Keep private state outside Git',
)
const base = 'http://localhost:3301'
let session
try {
  if (mode === 'configure') {
    session = await technicalSession(
      resolve(directory, 'browser-state.json'),
      'operator',
    )
    const grant = await session.api('admin/api-tokens', {
      name: 'Product Guide model configuration',
      scopes: ['admin'],
    })
    try {
      await configureCmsBlog({ url: base, token: grant.token })
    } finally {
      await session.api(
        `admin/api-tokens/${grant.info.id}`,
        undefined,
        'DELETE',
      )
    }
    console.log('PASS configured native public content models')
  } else {
    session = await technicalSession(
      resolve(directory, 'browser-state.json'),
      'editor',
    )
    const { page, api } = session
    const source = JSON.parse(
      await readFile(
        new URL(
          '../../content/product-guides/create-client.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    const ledgerPath = resolve(directory, 'guide-delivery.json')
    const ledger = await readPrivateJson(ledgerPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error
      return { ticket: 'BL-0100', media: {} }
    })
    assert.equal(ledger.ticket, 'BL-0100')
    if (mode === 'publish' && !ledger.id) {
      const existing = await api('content/product_guides?limit=100&locale=en')
      assert(
        !existing.items.some((item) => item.slug === source.slug),
        'Resolve an existing unrecorded guide before creating another',
      )
      const media = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
      await media.connect()
      for (const step of source.steps.filter((step) => step.screenshot)) {
        if (!ledger.media[step.screenshot]) {
          const uploaded = await media.uploadImage(
            resolve(
              repository,
              'content/product-guides/screenshots',
              step.screenshot,
            ),
            { alt: step.alt },
          )
          ledger.media[step.screenshot] = uploaded.item
          await writePrivateJson(ledgerPath, ledger)
        }
      }
      const paragraph = (text, key, extra = {}) => ({
        _type: 'block',
        _key: key,
        style: 'normal',
        markDefs: [],
        children: [{ _type: 'span', _key: key + '-text', text, marks: [] }],
        ...extra,
      })
      const body = [paragraph(source.introduction, 'introduction')]
      for (const [index, step] of source.steps.entries()) {
        body.push(
          paragraph(step.text, `step-${index + 1}`, {
            listItem: 'number',
            level: 1,
            listId: 'create-client-steps',
            listStart: 1,
          }),
        )
        if (step.screenshot) {
          const image = ledger.media[step.screenshot]
          body.push({
            _type: 'image',
            _key: `screen-${index + 1}`,
            asset: { _ref: image.id, url: image.url },
            alt: step.alt,
            width: image.width,
            height: image.height,
          })
        }
      }
      body.push(
        paragraph('اگر مشتری از قبل ثبت شده است', 'after-title', {
          style: 'h2',
        }),
        paragraph(source.afterwards, 'afterwards'),
      )
      const saved = await api('content/product_guides', {
        slug: source.slug,
        status: 'draft',
        locale: 'en',
        data: {
          title: source.title,
          summary: source.summary,
          body,
          seo_title: source.seo_title,
          seo_description: source.seo_description,
          search_excluded: false,
          reviewed_at: source.reviewed_at,
          reviewer_name: source.reviewer_name,
        },
      })
      ledger.id = saved.item.id
      ledger.slug = saved.item.slug
      ledger.deliveredAt = new Date().toISOString()
      await writePrivateJson(ledgerPath, ledger)
    }
    assert(ledger.id, 'Publish the retained example before verifying')
    let saved = await api(`content/product_guides/${ledger.id}`)
    await page.goto(
      `/_emdash/admin/content/product_guides/${ledger.id}?locale=en`,
    )
    await expect(page.getByLabel('عنوان', { exact: true })).toHaveValue(
      source.title,
    )
    await expect(page.locator('[contenteditable="true"] ol li')).toHaveCount(5)
    await expect(page.locator('[contenteditable="true"] img')).toHaveCount(3)
    await page.screenshot({
      path: resolve(directory, 'guide-native-editor.png'),
      fullPage: true,
    })
    const preview = new URL(
      (await api(`content/product_guides/${ledger.id}/preview-url`, {})).url,
      base,
    ).href
    assert.equal(new URL(preview).origin, base)
    const previewResponse = await page.goto(preview)
    assert.equal(previewResponse.status(), 200)
    assert.match(
      previewResponse.headers()['cache-control'],
      /private, no-store/,
    )
    assert.match(previewResponse.headers()['x-robots-tag'], /noindex/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      source.title,
    )
    await expect(page.locator('article img')).toHaveCount(3)
    await writePrivateJson(resolve(directory, 'guide-preview.json'), {
      url: preview,
      renewedAt: new Date().toISOString(),
    })
    assert.equal((await fetch(preview, { redirect: 'manual' })).status, 403)
    if (mode === 'publish' && saved.item.status === 'draft') {
      assert(
        !saved.item.liveRevisionId && !saved.item.scheduledAt,
        'Publish only the initial unpublished example',
      )
      await page.goto(
        `/_emdash/admin/content/product_guides/${ledger.id}?locale=en`,
      )
      await page
        .getByRole('button', { name: 'Publish now', exact: true })
        .first()
        .click()
      const [published] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.request().method() === 'POST' &&
            new URL(r.url()).pathname.endsWith(
              `/product_guides/${ledger.id}/publish`,
            ),
        ),
        page
          .getByRole('dialog')
          .getByRole('button', { name: 'Publish now', exact: true })
          .click(),
      ])
      assert(published.ok(), 'Native Publish failed')
      saved = await api(`content/product_guides/${ledger.id}`)
    }
    assert.equal(saved.item.status, 'published')
    assert(saved.item.liveRevisionId)
    assert.equal(saved.item.slug, source.slug)
    const anonymous = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 430, height: 932 } })
    try {
      const reader = await anonymous.newPage()
      assert.equal(
        (await reader.goto(`${base}/guides/${source.slug}`)).status(),
        200,
      )
      await expect(reader.locator('article ol li')).toHaveCount(5)
      for (const image of await reader.locator('article img').all()) {
        await image.scrollIntoViewIfNeeded()
        await expect
          .poll(() =>
            image.evaluate((img) => img.complete && img.naturalWidth > 0),
          )
          .toBe(true)
        const response = await fetch(
          new URL(await image.getAttribute('src'), base),
        )
        assert.equal(response.status, 200)
        const dimensions = await sharp(
          Buffer.from(await response.arrayBuffer()),
        ).metadata()
        assert.equal(dimensions.width, 430)
        assert.equal(dimensions.height, 932)
      }
      await reader.screenshot({
        path: resolve(directory, 'guide-public-mobile.png'),
        fullPage: true,
      })
      await reader.setViewportSize({ width: 1440, height: 1000 })
      await reader.screenshot({
        path: resolve(directory, 'guide-public-desktop.png'),
        fullPage: true,
      })
      assert.equal(
        (await reader.request.get(preview)).status(),
        403,
        'Authenticated response must not poison an anonymous cache',
      )
    } finally {
      await anonymous.close()
    }
    await checkProductGuide(`${base}/guides/${source.slug}`)
    await checkGuideDiscovery(base, { present: [source.slug] })
    const launch = JSON.parse(
      await readFile(
        new URL('../../content/blog-launch/delivery.json', import.meta.url),
        'utf8',
      ),
    )
    for (const article of Object.values(launch.articles)) {
      const current = await api(`content/blog_articles/${article.id}`)
      assert.equal(current.item.status, 'draft')
      assert(!current.item.liveRevisionId && !current.item.scheduledAt)
      assert.equal((await fetch(`${base}/blog/${article.slug}`)).status, 404)
    }
    await writePrivateJson(resolve(directory, 'guide-verification.json'), {
      verifiedAt: new Date().toISOString(),
      id: ledger.id,
      slug: ledger.slug,
      nativeEditorReopen: true,
      authenticatedPreview: true,
      anonymousPreviewDenied: true,
      publishedOrderedSteps: 5,
      decodedScreenshots: 3,
      metadataDiscovery: true,
      launchDraftsPreserved: 3,
      humanTrial: 'pending BL-0101 end-of-work trial',
    })
    console.log(
      'PASS retained illustrated Product Guide, native editor/preview, public metadata/discovery and three untouched launch drafts',
    )
  }
} catch (error) {
  await writeFile(
    resolve(directory, 'guide-delivery-error.txt'),
    String(error.stack).replace(/_preview=[^\s"']+/g, '_preview=[redacted]'),
    { mode: 0o600 },
  )
  await chmod(resolve(directory, 'guide-delivery-error.txt'), 0o600)
  console.error(`GUIDE_DELIVERY_FAILED ${error.name}`)
  process.exitCode = 1
} finally {
  await session?.close()
}
