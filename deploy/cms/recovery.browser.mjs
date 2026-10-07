#!/usr/bin/env node
// Technical accounts only. The intended editor registers their own passkey.
import assert from 'node:assert/strict'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { chromium, expect } from '@playwright/test'
import sharp from 'sharp'
import {
  checkBlogArticle,
  checkBlogDiscovery,
} from '../../scripts/smoke-blog.mjs'

const [mode, directory, phase = mode] = process.argv.slice(2)
assert(
  ['bootstrap', 'verify', 'candidate'].includes(mode),
  'Choose bootstrap, verify, or candidate',
)
assert(
  directory && resolve(directory) === directory,
  'Supply an absolute private state directory',
)
const base = process.env.CMS_REHEARSAL_URL ?? 'http://localhost:3301'
assert(/^[a-z][a-z0-9-]*$/.test(phase), 'Use a simple phase name')
const repository = resolve(new URL('../..', import.meta.url).pathname)
assert(
  directory !== repository && !directory.startsWith(`${repository}/`),
  'Store private state outside Git',
)
assert.equal(
  base,
  'http://localhost:3301',
  'This fixture operates only on the isolated local copy',
)
await mkdir(directory, { recursive: true, mode: 0o700 })
await chmod(directory, 0o700)
const statePath = resolve(directory, 'browser-state.json')
const save = async (path, value) => {
  await writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 })
  await chmod(path, 0o600)
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
})
let state
const accounts = []

async function api(
  page,
  path,
  body,
  method = body === undefined ? 'GET' : 'POST',
) {
  const response = await page.request.fetch(`${base}/_emdash/api/${path}`, {
    method,
    headers: { 'X-EmDash-Request': '1' },
    ...(body === undefined ? {} : { data: body }),
  })
  assert(
    response.ok(),
    `${method} ${path.split('?')[0]} returned ${response.status()}`,
  )
  const json = await response.json()
  assert(json.success, `CMS request failed: ${path.split('?')[0]}`)
  return json.data
}

async function account(credentials, role) {
  const page = await (await browser.newContext({ baseURL: base })).newPage()
  page.setDefaultTimeout(20_000)
  await page.goto('/_emdash/api/setup/status')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  )
  for (const credential of credentials ?? [])
    await cdp.send('WebAuthn.addCredential', { authenticatorId, credential })
  page.fixtureRole = role
  accounts.push(page)
  page.savedCredentials = async () =>
    (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials
  return page
}

async function credential(page, path, body, operation) {
  const registration = await api(page, path, body)
  return page.evaluate(
    async ({ options, operation }) => {
      const credential =
        operation === 'create'
          ? await navigator.credentials.create({
              publicKey:
                PublicKeyCredential.parseCreationOptionsFromJSON(options),
            })
          : await navigator.credentials.get({
              publicKey:
                PublicKeyCredential.parseRequestOptionsFromJSON(options),
            })
      return credential.toJSON()
    },
    { options: registration.options, operation },
  )
}

async function signIn(page) {
  await api(page, 'auth/passkey/verify', {
    credential: await credential(page, 'auth/passkey/options', {}, 'get'),
  })
}

async function editorShell(page) {
  await page.goto('/_emdash/admin')
  await page
    .locator('a[href="/_emdash/admin/content/blog_articles"]')
    .first()
    .waitFor()
  const welcome = page.getByRole('button', { name: 'Get Started', exact: true })
  if (await welcome.isVisible()) await welcome.click()
}

const block = (text) => [
  {
    _type: 'block',
    _key: 'paragraph',
    style: 'normal',
    markDefs: [],
    children: [{ _type: 'span', _key: 'text', text, marks: [] }],
  },
]

try {
  if (mode === 'bootstrap') {
    assert(
      (await readFile(statePath).catch(() => null)) === null,
      'Private fixture state already exists',
    )
    const persistedAccounts = await readFile(
      resolve(directory, 'technical-accounts.json'),
      'utf8',
    )
      .then(JSON.parse)
      .catch(() => null)
    let operator, editor
    if (persistedAccounts) {
      operator = await account(persistedAccounts.operator, 'operator')
      editor = await account(persistedAccounts.editor, 'editor')
      await signIn(operator)
      await signIn(editor)
    } else {
      operator = await account(undefined, 'operator')
      assert(
        (await api(operator, 'setup/status')).needsSetup,
        'Use a fresh isolated CMS',
      )
      await api(operator, 'setup', {
        title: 'نسخه محلی آزمایش سالونا',
        includeContent: false,
      })
      await api(operator, 'setup/admin/verify', {
        credential: await credential(
          operator,
          'setup/admin',
          {
            email: 'technical-operator@cms.local.test',
            name: 'Technical recovery operator',
          },
          'create',
        ),
      })
      await signIn(operator)
      const invitation = await api(operator, 'auth/invite', {
        email: 'technical-editor@cms.local.test',
        role: 40,
      })
      assert(
        invitation.inviteUrl,
        'No email provider should be configured in this rehearsal',
      )
      const token = new URL(invitation.inviteUrl).searchParams.get('token')
      editor = await account(undefined, 'editor')
      await api(editor, 'auth/invite/complete', {
        token,
        name: 'Technical recovery editor',
        credential: await credential(
          editor,
          'auth/invite/register-options',
          { token, name: 'Technical recovery editor' },
          'create',
        ),
      })
    }
    // Preserve technical registration even if a later UI check fails.
    await save(resolve(directory, 'technical-accounts.json'), {
      operator: await operator.savedCredentials(),
      editor: await editor.savedCredentials(),
    })
    await editorShell(editor)
    const image = await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#f3d5dd' },
    })
      .png()
      .toBuffer()
    await editor.goto('/_emdash/admin/content/blog_articles/new')
    await editor
      .getByLabel('عنوان', { exact: true })
      .fill('مقاله منتشرشده برای آزمون ماندگاری')
    await editor
      .getByLabel('خلاصه', { exact: true })
      .fill('متن فارسی و تصویر باید پس از بازیابی باقی بمانند.')
    await editor
      .locator('[contenteditable="true"]')
      .first()
      .fill('این مقاله برای بررسی ماندگاری محتوا و تصویر ساخته شده است.')
    await editor
      .getByRole('button', { name: 'Select image', exact: true })
      .click()
    const picker = editor.getByRole('dialog')
    await picker.getByLabel('Choose files to upload').setInputFiles({
      name: 'recovery-cover.png',
      mimeType: 'image/png',
      buffer: image,
    })
    await expect(
      picker.getByRole('button', { name: 'Select', exact: true }),
    ).toBeEnabled()
    await picker.getByRole('button', { name: 'Select', exact: true }).click()
    await editor
      .getByRole('button', { name: 'Insert Image', exact: true })
      .click()
    await editor
      .getByRole('dialog')
      .getByRole('button', { name: 'recovery-cover.png', exact: true })
      .click()
    await editor
      .getByRole('dialog')
      .getByRole('button', { name: 'Insert image', exact: true })
      .click()
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(editor).toHaveURL(
      /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
    )
    const articleId = new URL(editor.url()).pathname.split('/').at(-1)
    let article = await api(editor, `content/blog_articles/${articleId}`)
    await api(
      editor,
      `content/blog_articles/${articleId}`,
      { slug: 'recovery-published-article', _rev: article._rev },
      'PUT',
    )
    await api(editor, `content/blog_articles/${articleId}/publish`, {})
    article = await api(editor, `content/blog_articles/${articleId}`)
    await api(
      editor,
      `content/blog_articles/${articleId}`,
      { data: { title: 'عنوان خصوصی بعد از انتشار' }, _rev: article._rev },
      'PUT',
    )
    const draft = await api(editor, 'content/blog_articles', {
      slug: 'recovery-private-draft',
      status: 'draft',
      data: {
        title: 'پیش‌نویس فارسی برای آزمون بازیابی',
        summary: 'یادداشت خصوصی اولیه',
        body: block('این متن هنوز منتشر نشده است.'),
      },
    })
    const media = (await api(editor, 'media')).items.find(
      (item) => item.filename === 'recovery-cover.png',
    )
    assert(media?.url, 'Uploaded media has no public URL')
    state = {
      operator: await operator.savedCredentials(),
      editor: await editor.savedCredentials(),
      articleId,
      draftId: draft.item.id,
      mediaUrl: media.url,
      mediaSha256: createHash('sha256').update(image).digest('hex'),
      summary: 'یادداشت خصوصی اولیه',
    }
    await save(statePath, state)
    // Leave this invitation unconsumed for the human's physical passkey at the end.
    const human = await api(operator, 'auth/invite', {
      email: 'intended-editor@cms.local.test',
      role: 40,
    })
    assert(
      human.inviteUrl,
      'Expected a copy-link invitation without outgoing email',
    )
    await save(resolve(directory, 'intended-editor-invitation.json'), {
      inviteUrl: human.inviteUrl,
      role: 40,
      note: 'Unconsumed local placeholder invitation. The user registers their own physical passkey at the end.',
    })
    await operator.context().close()
    await editor.context().close()
  } else state = JSON.parse(await readFile(statePath, 'utf8'))

  const operator = await account(state.operator, 'operator')
  await signIn(operator)
  assert(
    (await api(operator, 'auth/me')).role >= 50,
    'Operator authentication failed',
  )
  const editor = await account(state.editor, 'editor')
  await signIn(editor)
  assert.equal((await api(editor, 'auth/me')).role, 40)
  await editorShell(editor)
  const current = await api(editor, `content/blog_articles/${state.articleId}`)
  assert.equal(current.item.data.title, 'عنوان خصوصی بعد از انتشار')
  assert.equal(current.item.status, 'published')
  const draft = await api(editor, `content/blog_articles/${state.draftId}`)
  assert.equal(draft.item.status, 'draft')
  assert.equal(draft.item.data.summary, state.summary)
  await editor.goto(`/_emdash/admin/content/blog_articles/${state.draftId}`)
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'پیش‌نویس فارسی برای آزمون بازیابی',
  )
  const summary = `ویرایش فنی در مرحله ${phase} ${new Date().toISOString()}`
  await editor.getByLabel('خلاصه', { exact: true }).fill(summary)
  const [saved] = await Promise.all([
    editor.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' &&
        new URL(r.url()).pathname.endsWith(`/blog_articles/${state.draftId}`),
    ),
    editor.getByRole('button', { name: 'Save', exact: true }).click(),
  ])
  assert(saved.ok(), 'Editor Save failed')
  await editor.reload()
  await expect(editor.getByLabel('خلاصه', { exact: true })).toHaveValue(summary)
  if (mode !== 'candidate') {
    state.summary = summary
    await save(statePath, state)
  }
  const preview = (
    await api(
      editor,
      `content/blog_articles/${state.articleId}/preview-url`,
      {},
    )
  ).url
  const response = await editor.goto(preview)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['cache-control'], /private.*no-store/)
  assert.match(response.headers()['x-robots-tag'], /noindex/)
  await expect(editor.getByRole('heading', { level: 1 })).toHaveText(
    'عنوان خصوصی بعد از انتشار',
  )
  await expect(editor.locator('#emdash-toolbar')).toHaveCount(0)
  await expect(editor.locator('article img')).toHaveCount(2)
  await editor.screenshot({
    path: resolve(directory, `${phase}-preview.png`),
    fullPage: true,
  })
  assert.equal(
    (await fetch(new URL(preview, base))).status,
    403,
    'Copied anonymous preview must be denied',
  )
  assert.equal((await fetch(`${base}/blog/recovery-private-draft`)).status, 404)
  await editor.setViewportSize({ width: 1280, height: 1100 })
  await editor.goto(`/_emdash/admin/content/blog_articles/${state.articleId}`)
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'عنوان خصوصی بعد از انتشار',
  )
  await expect(
    editor.locator('[contenteditable="true"] img').first(),
  ).toBeVisible()
  await editor.screenshot({
    path: resolve(directory, `${phase}-editor.png`),
    fullPage: true,
  })
  const publicPage = await (await browser.newContext()).newPage()
  await publicPage.goto(`${base}/blog/recovery-published-article`)
  await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText(
    'مقاله منتشرشده برای آزمون ماندگاری',
  )
  await expect(publicPage.locator('article img')).toHaveCount(2)
  for (const image of await publicPage.locator('article img').all())
    assert(
      await image.evaluate((img) => img.complete && img.naturalWidth > 0),
      'Anonymous image did not decode',
    )
  const image = await fetch(new URL(state.mediaUrl, base))
  assert.equal(image.status, 200)
  assert.equal(
    createHash('sha256')
      .update(Buffer.from(await image.arrayBuffer()))
      .digest('hex'),
    state.mediaSha256,
  )
  await checkBlogArticle(`${base}/blog/recovery-published-article`)
  await checkBlogDiscovery(base, {
    present: ['recovery-published-article'],
    absent: ['recovery-private-draft'],
  })
  if (mode === 'candidate') {
    const probe = await api(editor, 'content/blog_articles', {
      slug: 'upgrade-publication-probe',
      status: 'draft',
      data: {
        title: 'آزمون انتشار پس از ارتقا',
        body: block('ویرایش و انتشار پس از ارتقا'),
      },
    })
    await api(editor, `content/blog_articles/${probe.item.id}/publish`, {})
    await checkBlogDiscovery(base, { present: ['upgrade-publication-probe'] })
    assert.equal(
      (await fetch(`${base}/blog/upgrade-publication-probe`)).status,
      200,
    )
    await api(editor, `content/blog_articles/${probe.item.id}/unpublish`, {})
    assert.equal(
      (await fetch(`${base}/blog/upgrade-publication-probe`)).status,
      404,
    )
    await checkBlogDiscovery(base, { absent: ['upgrade-publication-probe'] })
  }
  await save(resolve(directory, `${phase}-evidence.json`), {
    phase,
    checkedAt: new Date().toISOString(),
    operatorReauthentication: true,
    editorReauthentication: true,
    editorSavedPersianDraft: true,
    publishedAndStagedState: true,
    sessionPreview: true,
    anonymousPreviewDenied: true,
    coverAndInlineMedia: true,
    exactMediaBytes: true,
    runtimeDiscovery: true,
    candidatePublication: mode === 'candidate',
    humanTrial: 'pending',
  })
  console.log(
    `PASS ${phase}: native reauthentication, Persian Save, public/draft preview, media bytes, discovery`,
  )
} catch (error) {
  let index = 0
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .screenshot({
          path: resolve(directory, `${phase}-failure-${index++}.png`),
          fullPage: true,
        })
        .catch(() => {})
      await writeFile(
        resolve(directory, `${phase}-failure-admin.txt`),
        await page
          .locator('body')
          .innerText()
          .catch(() => ''),
        { mode: 0o600 },
      )
    }
  throw new Error(
    error.message.replace(/([?&](?:_preview|token)=)[^&\s]+/g, '$1[redacted]'),
  )
} finally {
  if (state) {
    for (const page of accounts)
      if (!page.isClosed())
        state[page.fixtureRole] = await page.savedCredentials()
    await save(statePath, state)
  }
  await browser.close()
}
