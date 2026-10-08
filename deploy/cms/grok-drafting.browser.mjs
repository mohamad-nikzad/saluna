import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import sharp from 'sharp'
import { technicalSession } from './technical-session.mjs'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
  DRAFT_SCOPES,
} from '../../scripts/cms-draft-client.mjs'

// Verifies an actual Studio-created/revised ID. Never creates or revises content.
const directory = resolve(process.argv[2] || '')
const studio = resolve(directory, 'grok-studio')
const created = await readPrivateJson(resolve(studio, 'created.json'))
const revised = await readPrivateJson(resolve(studio, 'revised.json'))
assert.equal(created.item.id, revised.item.id)
assert.notEqual(
  created._rev,
  revised._rev,
  'Studio must actually revise its saved draft',
)
const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
await client.connect()
const credentials = await readPrivateJson(
  resolve(directory, 'agent-oauth.json'),
)
assert.deepEqual(credentials.scope.split(' ').sort(), [...DRAFT_SCOPES].sort())
const current = await client.getArticle(created.item.id)
assert.equal(current.item.status, 'draft')
assert.equal(current.item.locale, 'en')
assert.equal(current.item.authorId, credentials.userId)
assert(!current.item.liveRevisionId && !current.item.scheduledAt)
assert(current.item.data.cover?.id)
const inline = current.item.data.body.find((node) => node._type === 'image')
assert(inline?.asset?._ref && inline.asset.url)
await client.getMedia(inline.asset._ref)
const preview = await readPrivateJson(
  resolve(studio, `preview-${current.item.id}.json`),
)
const base = 'http://localhost:3301'
assert.equal(new URL(preview.url).origin, base)
for (const path of ['admin/users', 'auth/me']) {
  const response = await fetch(`${base}/_emdash/api/${path}`, {
    headers: { Authorization: `Bearer ${credentials.access_token}` },
  })
  assert.equal(
    response.status,
    403,
    'Four-scope connection must not gain administration/profile access',
  )
}
let author, editor
let stage = 'author-session'
try {
  author = await technicalSession(
    resolve(directory, 'agent-browser-state.json'),
    'author',
  )
  assert.equal((await author.api('auth/me')).id, credentials.userId)
  stage = 'author-preview'
  const response = await author.page.goto(preview.url)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['cache-control'], /private.*no-store/)
  assert.match(response.headers()['x-robots-tag'], /noindex/)
  await expect(author.page.getByRole('heading', { level: 1 })).toHaveText(
    current.item.data.title,
  )
  await expect(
    author.page.getByText('تیم سالونا', { exact: true }),
  ).toBeVisible()
  assert((await author.page.title()).includes(current.item.data.seo_title))
  await expect(author.page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    current.item.data.seo_description,
  )
  stage = 'preview-content'
  await expect(author.page.locator('article h2')).not.toHaveCount(0)
  stage = 'preview-image-count'
  await expect(author.page.locator('article img')).toHaveCount(2)
  const publicImages = []
  stage = 'preview-image-decode'
  for (const img of await author.page.locator('article img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        img.evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
    publicImages.push(await img.getAttribute('src'))
  }
  stage = 'preview-signup'
  const signup = author.page.locator('article aside').getByRole('link', {
    name: 'شروع استفاده از سالونا',
    exact: true,
  })
  await expect(signup).toBeVisible()
  assert.equal(new URL(await signup.getAttribute('href')).pathname, '/signup')
  await expect(
    author.page.getByRole('link', {
      name: 'سالن خود را در سالونا بسازید',
      exact: true,
    }),
  ).toHaveAttribute('href', 'https://app.saluna.ir/signup')
  await author.page.screenshot({
    path: resolve(studio, 'author-preview.png'),
    fullPage: true,
  })
  stage = 'anonymous-images'
  for (const url of publicImages) {
    const imageResponse = await fetch(new URL(url, base))
    assert.equal(imageResponse.status, 200)
    assert.match(imageResponse.headers.get('content-type'), /^image\//)
    const dimensions = await sharp(
      Buffer.from(await imageResponse.arrayBuffer()),
    ).metadata()
    assert(dimensions.width > 0 && dimensions.height > 0)
  }
  stage = 'public-denials'
  for (const headers of [
    {},
    { Authorization: `Bearer ${credentials.access_token}` },
  ]) {
    const denied = await fetch(preview.url, { headers })
    assert.equal(denied.status, 403)
    assert.match(denied.headers.get('cache-control'), /private.*no-store/)
    assert.match(denied.headers.get('x-robots-tag'), /noindex/)
  }
  assert.equal((await fetch(`${base}/blog/${current.item.slug}`)).status, 404)
  for (const path of ['/blog', '/blog-sitemap.xml']) {
    const listed = await fetch(`${base}${path}`)
    assert.equal(listed.status, 200)
    const html = await listed.text()
    assert(
      !html.includes(current.item.slug) &&
        !html.includes(current.item.data.title),
    )
  }
  stage = 'editor-session'
  editor = await technicalSession(
    resolve(directory, 'browser-state.json'),
    'editor',
  )
  stage = 'editor-reopen'
  await editor.page.goto(
    `/_emdash/admin/content/blog_articles/${current.item.id}`,
  )
  await expect(editor.page.getByLabel('عنوان', { exact: true })).toHaveValue(
    current.item.data.title,
  )
  await expect(
    editor.page.locator('[contenteditable="true"] img'),
  ).toBeVisible()
  await expect(editor.page.getByLabel('عنوان برای جستجو')).toHaveValue(
    current.item.data.seo_title,
  )
  await editor.page.reload()
  await expect(editor.page.getByLabel('عنوان', { exact: true })).toHaveValue(
    current.item.data.title,
  )
  await editor.page.screenshot({
    path: resolve(studio, 'native-editor.png'),
    fullPage: true,
  })
  const original = JSON.parse(
    await (
      await import('node:fs/promises')
    ).readFile(
      new URL('../../content/blog-launch/delivery.json', import.meta.url),
      'utf8',
    ),
  )
  for (const article of Object.values(original.articles)) {
    const saved = await client.getArticle(article.id)
    assert.equal(saved.item.status, 'draft')
    assert(!saved.item.liveRevisionId && !saved.item.scheduledAt)
  }
  await writePrivateJson(resolve(studio, 'verification.json'), {
    verifiedAt: new Date().toISOString(),
    id: current.item.id,
    slug: current.item.slug,
    title: current.item.data.title,
    role: 30,
    scopes: DRAFT_SCOPES,
    createdAndRevisedSameId: true,
    defaultTeam: true,
    coverInlineMedia: true,
    anonymousMedia: true,
    sessionPreview: true,
    revisionedSeoAndSignup: true,
    copiedAndBearerPreviewDenied: true,
    publicDetailIndexSitemapExcluded: true,
    editorReopen: true,
    nativeAdministrationDenied: true,
    originalLaunchDraftsPreserved: 3,
    humanTrial: 'pending end-of-work trial',
  })
  console.log(
    'PASS actual Studio draft, dedicated Author/session/media/preview/public exclusion and editor reopen',
  )
} catch (error) {
  console.error(`GROK_VERIFICATION_FAILED ${stage} ${error.name}`)
  await (editor?.page || author?.page)?.screenshot({
    path: resolve(studio, 'verification-failure.png'),
    fullPage: true,
  })
  process.exitCode = 1
} finally {
  await author?.close()
  await editor?.close()
}
