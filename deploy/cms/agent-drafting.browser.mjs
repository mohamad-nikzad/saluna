#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import sharp from 'sharp'
import { cmsDraftClient } from '../../scripts/cms-draft-client.mjs'

const [mode, directory] = process.argv.slice(2)
assert(
  ['setup', 'verify', 'permissions'].includes(mode),
  'Use setup, verify or permissions',
)
assert(
  directory && resolve(directory) === directory,
  'Use an absolute private directory',
)
const base = 'http://localhost:3301'
const scopes = ['content:read', 'content:write', 'media:read', 'media:write']
const statePath = resolve(directory, 'agent-browser-state.json')
const tokenPath = resolve(directory, 'agent-oauth.json')
const operatorPath = resolve(directory, 'browser-state.json')
await mkdir(directory, { recursive: true, mode: 0o700 })
await chmod(directory, 0o700)
const save = async (path, value) => {
  await writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 })
  await chmod(path, 0o600)
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
})
const accounts = []
let operatorState, state
async function api(page, path, body) {
  const response = await page.request.fetch(`${base}/_emdash/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-EmDash-Request': '1' },
    ...(body === undefined ? {} : { data: body }),
  })
  assert(
    response.ok(),
    `Native ${path.split('?')[0]} HTTP ${response.status()}`,
  )
  const result = await response.json()
  assert(result.success, `Native ${path.split('?')[0]} failed`)
  return result.data
}
async function account(credentials, name) {
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
  page.credentials = async () =>
    (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials
  page.accountName = name
  accounts.push(page)
  return page
}
async function passkey(page, path, body, operation) {
  const data = await api(page, path, body)
  return page.evaluate(
    async ({ options, operation }) => {
      const key =
        operation === 'get'
          ? await navigator.credentials.get({
              publicKey:
                PublicKeyCredential.parseRequestOptionsFromJSON(options),
            })
          : await navigator.credentials.create({
              publicKey:
                PublicKeyCredential.parseCreationOptionsFromJSON(options),
            })
      return key.toJSON()
    },
    { options: data.options, operation },
  )
}
async function signIn(page) {
  await api(page, 'auth/passkey/verify', {
    credential: await passkey(page, 'auth/passkey/options', {}, 'get'),
  })
}
async function invite(operator, name, role) {
  const invitation = await api(operator, 'auth/invite', {
    email: `${name}@cms.local.test`,
    role,
  })
  assert(
    invitation.inviteUrl,
    'Local copy must have no outgoing email provider',
  )
  const token = new URL(invitation.inviteUrl).searchParams.get('token')
  const page = await account(undefined, name)
  await api(page, 'auth/invite/complete', {
    token,
    name,
    credential: await passkey(
      page,
      'auth/invite/register-options',
      { token, name },
      'create',
    ),
  })
  return page
}
async function authorize(page, requested, path) {
  const device = await api(page, 'oauth/device/code', {
    client_id: 'saluna-drafts',
    scope: requested.join(' '),
  })
  await page.goto(
    `/_emdash/admin/device?code=${encodeURIComponent(device.user_code)}`,
  )
  await expect(
    page.getByRole('button', { name: 'Authorize', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Authorize', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Device authorized', exact: true }),
  ).toBeVisible()
  const result = await api(page, 'oauth/device/token', {
    device_code: device.device_code,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  const me = await api(page, 'auth/me')
  await save(path, {
    ...result,
    expiresAt: Date.now() + result.expires_in * 1000,
    baseURL: base,
    locale: 'en',
    userId: me.id,
    role: me.role,
  })
  return result
}
async function nativeTool(token, name, args) {
  const response = await fetch(`${base}/_emdash/api/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  assert.equal(response.status, 200, 'Native MCP must return a tool envelope')
  const text = await response.text()
  const message = response.headers
    .get('content-type')
    .includes('text/event-stream')
    ? JSON.parse(
        text
          .split('\n')
          .find((line) => line.startsWith('data:'))
          .slice(5),
      )
    : JSON.parse(text)
  return message.result
}
async function deny(token, name, args, code) {
  const result = await nativeTool(token, name, args)
  assert.equal(result.isError, true, `${name} must be denied`)
  assert.equal(
    result._meta?.code ?? result.content[0].text.match(/^\[([A-Z_]+)\]/)?.[1],
    code,
    `${name} denial code`,
  )
}
try {
  state = await readFile(statePath, 'utf8')
    .then(JSON.parse)
    .catch(() => ({}))
  if (mode === 'setup') {
    operatorState = JSON.parse(await readFile(operatorPath, 'utf8'))
    const operator = await account(operatorState.operator, 'operator')
    await signIn(operator)
    assert(!state.author, 'Dedicated agent already registered; use verify')
    const author = await invite(operator, 'saluna-drafting-agent', 30)
    state.author = await author.credentials()
    await save(statePath, state)
    const granted = await authorize(author, scopes, tokenPath)
    assert.deepEqual(granted.scope.split(' ').sort(), [...scopes].sort())
    console.log(
      'PASS native dedicated Author30 OAuth approval with four scopes',
    )
  }
  const client = await cmsDraftClient(tokenPath)
  const discovery = await client.connect()
  for (const name of [
    'content_create',
    'content_get',
    'content_update',
    'media_upload',
    'media_get',
  ])
    assert(
      discovery.tools.some((tool) => tool.name === name),
      `Missing supported ${name}`,
    )
  assert(
    !discovery.tools.some((tool) => tool.name === 'preview_url'),
    'Use supported REST preview adjunct',
  )
  console.log('PASS supported MCP initialization and drafting/media discovery')
  if (!state.draftId) {
    const saved = await client.createDraft({
      slug: 'agent-interface-persian-draft',
      data: {
        title: 'پیش‌نویس فارسی از اتصال نویسنده',
        summary: 'نمونه فنی اتصال نویسنده به سالونا',
        body: '## یادداشت خصوصی\n\nاین متن فقط برای آزمون اتصال نویسنده ذخیره می‌شود.',
        seo_title: 'آزمون اتصال نویسنده سالونا',
        seo_description: 'پیش‌نویس خصوصی برای بررسی اتصال پشتیبانی‌شده',
      },
    })
    state.draftId = saved.item.id
    await save(statePath, state)
  }
  const saved = await client.getArticle(state.draftId)
  assert.equal(saved.item.status, 'draft')
  assert.equal(saved.item.locale, 'en')
  assert.equal(saved.item.data.title, 'پیش‌نویس فارسی از اتصال نویسنده')
  assert.equal(
    saved.item.authorId,
    JSON.parse(await readFile(tokenPath, 'utf8')).userId,
  )
  assert(
    !saved.item.liveRevisionId && !saved.item.scheduledAt,
    'Plain unscheduled draft required',
  )
  console.log(
    'PASS dedicated Author created and read a Persian draft in the editor locale',
  )
  await client.reviseDraft(saved, {
    summary: 'ویرایش پیش‌نویس با حساب نویسنده اختصاصی',
  })
  const revised = await client.getArticle(state.draftId)
  assert.equal(
    revised.item.data.summary,
    'ویرایش پیش‌نویس با حساب نویسنده اختصاصی',
  )
  assert.equal(revised.item.status, 'draft')
  assert(!revised.item.liveRevisionId && !revised.item.scheduledAt)
  console.log('PASS native MCP revision remains an unscheduled private draft')
  const imagePath = resolve(directory, 'agent-interface-image.png')
  await writeFile(
    imagePath,
    await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#7a2a40' },
    })
      .png()
      .toBuffer(),
    { mode: 0o600 },
  )
  const uploaded = await client.uploadImage(imagePath, {
    alt: 'تصویر نمونه اتصال نویسنده',
  })
  state.mediaId = uploaded.item.id
  await save(statePath, state)
  const media = await client.getMedia(state.mediaId)
  assert.equal(media.item.width, 640)
  assert.equal(media.item.height, 360)
  const article = await client.getArticle(state.draftId)
  const body = article.item.data.body.filter((node) => node._type !== 'image')
  assert(uploaded.item.url, 'Native upload must return its media URL')
  const publicImage = await fetch(new URL(uploaded.item.url, base))
  assert.equal(publicImage.status, 200)
  assert(
    Buffer.from(await publicImage.arrayBuffer()).equals(
      await readFile(imagePath),
    ),
    'Anonymous media must match uploaded bytes',
  )
  const publicBrowser = await (
    await browser.newContext({ baseURL: base })
  ).newPage()
  await publicBrowser.goto('/blog')
  assert.deepEqual(
    await publicBrowser.evaluate(
      (url) =>
        new Promise((resolve, reject) => {
          const image = new Image()
          image.onload = () =>
            resolve([image.naturalWidth, image.naturalHeight])
          image.onerror = () =>
            reject(new Error('Anonymous media decode failed'))
          image.src = url
        }),
      new URL(uploaded.item.url, base).href,
    ),
    [640, 360],
  )
  body.push({
    _type: 'image',
    _key: 'agent-image',
    asset: { _type: 'reference', _ref: media.item.id, url: uploaded.item.url },
    alt: 'تصویر نمونه اتصال نویسنده',
    width: 640,
    height: 360,
  })
  await client.reviseDraft(article, {
    body,
    cover: {
      provider: 'local',
      id: media.item.id,
      alt: 'تصویر نمونه اتصال نویسنده',
    },
  })
  const attached = await client.getArticle(state.draftId)
  assert.equal(attached.item.data.cover.id, media.item.id)
  assert.equal(
    attached.item.data.body.find((node) => node._type === 'image').asset._ref,
    media.item.id,
  )
  assert.equal(attached.item.status, 'draft')
  console.log('PASS native MCP upload/read and cover/inline attachment')
  const preview = await client.preview(state.draftId)
  await save(resolve(directory, 'agent-preview.json'), preview)
  const author = await account(state.author, 'saluna-drafting-agent')
  await signIn(author)
  assert.equal((await api(author, 'auth/me')).role, 30)
  const response = await author.goto(new URL(preview.url, base).href)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['cache-control'], /private.*no-store/)
  assert.match(response.headers()['x-robots-tag'], /noindex/)
  await expect(author.getByRole('heading', { level: 1 })).toHaveText(
    'پیش‌نویس فارسی از اتصال نویسنده',
  )
  await expect(author.getByText('تیم سالونا', { exact: true })).toBeVisible()
  await expect(author.locator('article img')).toHaveCount(2)
  for (const img of await author.locator('article img').all()) {
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        img.evaluate((element) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true)
  }
  await author.screenshot({
    path: resolve(directory, 'agent-preview.png'),
    fullPage: true,
  })
  const anonymous = await fetch(new URL(preview.url, base))
  assert.equal(anonymous.status, 403)
  assert.equal(
    (await fetch(`${base}/blog/agent-interface-persian-draft`)).status,
    404,
  )
  for (const path of ['/blog', '/blog-sitemap.xml']) {
    const listed = await fetch(`${base}${path}`)
    assert.equal(listed.status, 200)
    assert(!(await listed.text()).includes('agent-interface-persian-draft'))
  }
  assert.equal(
    (
      await fetch(new URL(preview.url, base), {
        headers: {
          Authorization: `Bearer ${JSON.parse(await readFile(tokenPath, 'utf8')).access_token}`,
        },
      })
    ).status,
    403,
    'Bearer alone must not substitute for a browser session',
  )
  console.log(
    'PASS real Author session preview with images and anonymous/Bearer-only denial; draft absent publicly',
  )
  operatorState ??= JSON.parse(await readFile(operatorPath, 'utf8'))
  const editor = await account(operatorState.editor, 'editor')
  await signIn(editor)
  await editor.goto('/_emdash/admin/content/blog_articles')
  const entry = editor.locator(`a[href*="/${state.draftId}"]`).first()
  await expect(entry).toBeVisible()
  await entry.click()
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'پیش‌نویس فارسی از اتصال نویسنده',
  )
  await expect(editor.getByLabel('خلاصه', { exact: true })).toHaveValue(
    'ویرایش پیش‌نویس با حساب نویسنده اختصاصی',
  )
  await expect(editor.locator('[contenteditable="true"] img')).toBeVisible()
  await editor.reload()
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'پیش‌نویس فارسی از اتصال نویسنده',
  )
  await editor.setViewportSize({ width: 1280, height: 1100 })
  await editor.screenshot({
    path: resolve(directory, 'agent-editor.png'),
    fullPage: true,
  })
  await editor.goto(new URL(preview.url, base).href)
  await expect(editor.getByRole('heading', { level: 1 })).toHaveText(
    'پیش‌نویس فارسی از اتصال نویسنده',
  )
  await editor.goto('/_emdash/admin')
  console.log(
    'PASS saved agent draft visible and reopenable in the native Editor default locale',
  )
  if (mode === 'permissions') {
    const operator = await account(operatorState.operator, 'operator')
    await signIn(operator)
    for (const [name, role] of [
      ['saluna-agent-subscriber', 10],
      ['saluna-agent-contributor', 20],
    ]) {
      const identity = state[name]
        ? await account(state[name], name)
        : await invite(operator, name, role)
      if (state[name]) await signIn(identity)
      state[name] = await identity.credentials()
      await save(statePath, state)
      const path = resolve(directory, `${name}-oauth.json`)
      const grant = await authorize(identity, scopes, path)
      try {
        if (role === 10) {
          assert(!grant.scope.split(' ').includes('content:write'))
          await deny(
            grant.access_token,
            'content_create',
            {
              collection: 'blog_articles',
              slug: 'forbidden-subscriber',
              status: 'draft',
              locale: 'en',
              data: { title: 'رد دسترسی مشترک' },
            },
            'INSUFFICIENT_SCOPE',
          )
          await deny(
            grant.access_token,
            'content_get',
            { collection: 'blog_articles', id: state.draftId },
            'NOT_FOUND',
          )
        } else {
          assert.deepEqual(grant.scope.split(' ').sort(), [...scopes].sort())
          if (!state.contributorDraftId) {
            const created = await nativeTool(
              grant.access_token,
              'content_create',
              {
                collection: 'blog_articles',
                slug: 'agent-contributor-role-probe',
                status: 'draft',
                locale: 'en',
                data: {
                  title: 'آزمون نقش همکار',
                  summary: 'نقش همکار حق ویرایش ندارد',
                  body: 'این پیش‌نویس فنی منتشر نمی‌شود.',
                },
              },
            )
            assert(!created.isError)
            state.contributorDraftId = JSON.parse(
              created.content[0].text,
            ).item.id
            await save(statePath, state)
          }
          const current = JSON.parse(
            (
              await nativeTool(grant.access_token, 'content_get', {
                collection: 'blog_articles',
                id: state.contributorDraftId,
              })
            ).content[0].text,
          )
          await deny(
            grant.access_token,
            'content_update',
            {
              collection: 'blog_articles',
              id: state.contributorDraftId,
              status: 'draft',
              data: { summary: 'تغییر غیرمجاز' },
              _rev: current._rev,
            },
            'INSUFFICIENT_PERMISSIONS',
          )
          const unchanged = JSON.parse(
            (
              await nativeTool(grant.access_token, 'content_get', {
                collection: 'blog_articles',
                id: state.contributorDraftId,
              })
            ).content[0].text,
          )
          assert.equal(unchanged.item.data.summary, 'نقش همکار حق ویرایش ندارد')
        }
      } finally {
        await api(identity, 'oauth/token/revoke', {
          token: grant.refresh_token,
        })
      }
    }
    const operations = {
      'content:read': [
        'content_get',
        { collection: 'blog_articles', id: state.draftId },
      ],
      'content:write': [
        'content_update',
        {
          collection: 'blog_articles',
          id: state.draftId,
          status: 'draft',
          data: { title: 'رد دسترسی' },
          _rev: attached._rev,
        },
      ],
      'media:read': ['media_get', { id: state.mediaId }],
      'media:write': [
        'media_upload',
        {
          filename: 'forbidden.png',
          contentType: 'image/png',
          base64: (await readFile(imagePath)).toString('base64'),
        },
      ],
    }
    for (const scope of scopes) {
      const grant = await authorize(
        author,
        scopes.filter((value) => value !== scope),
        resolve(directory, `agent-without-${scope.replace(':', '-')}.json`),
      )
      try {
        await deny(
          grant.access_token,
          ...operations[scope],
          'INSUFFICIENT_SCOPE',
        )
      } finally {
        await api(author, 'oauth/token/revoke', { token: grant.refresh_token })
      }
    }
    const token = JSON.parse(await readFile(tokenPath, 'utf8')).access_token
    await deny(token, 'settings_get', {}, 'INSUFFICIENT_SCOPE')
    await deny(
      token,
      'schema_create_collection',
      { slug: 'forbidden_agent', label: 'Forbidden' },
      'INSUFFICIENT_SCOPE',
    )
    assert.equal(
      (
        await fetch(`${base}/_emdash/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await fetch(`${base}/_emdash/api/auth/invite`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-EmDash-Request': '1',
          },
          body: JSON.stringify({
            email: 'forbidden-agent@cms.local.test',
            role: 40,
          }),
        })
      ).status,
      403,
    )
    console.log(
      'PASS separate Subscriber/Contributor role denial, each missing scope, and CMS administration denial',
    )
  }
} catch (error) {
  throw new Error(
    error.message
      .replace(/([?&](?:_preview|token|code)=)[^&\s]+/g, '$1[redacted]')
      .replace(/ec_[A-Za-z0-9_-]+/g, '[redacted]'),
  )
} finally {
  for (const page of accounts) {
    const credentials = await page.credentials()
    if (page.accountName === 'operator') operatorState.operator = credentials
    else if (page.accountName === 'editor') operatorState.editor = credentials
    else if (page.accountName === 'saluna-drafting-agent')
      state.author = credentials
    else state[page.accountName] = credentials
  }
  if (operatorState) await save(operatorPath, operatorState)
  if (state) await save(statePath, state)
  await browser.close()
}
