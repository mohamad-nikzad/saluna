import { expect, test, type Page } from '@playwright/test'
import { blogArticleBylines } from '../../apps/web/src/lib/blog-byline'
import { configureCmsBlog } from '../../scripts/configure-cms-blog.mjs'
import { cms, invitedAccount, openAdmin, operatorAccount } from './accounts'

test.describe.configure({ mode: 'serial' })

let operator: Page
let author: Page
let editor: Page

test.beforeAll(async ({ browser }) => {
  operator = await operatorAccount(browser)
  const initial = await cms(operator, 'schema/collections/blog_articles')
  expect(initial.item.supports).toContain('revisions')
  // An initialized BL-0092 site can lack this model. Exercise that upgrade
  // through the administrator API before creating any test content.
  await cms(operator, 'schema/collections/blog_articles', undefined, 'DELETE')
  const credentials = await cms(operator, 'admin/api-tokens', {
    name: 'Blog Article provisioning',
    scopes: ['admin'],
  })
  await configureCmsBlog({
    url: 'http://localhost:3303',
    token: credentials.token,
  })
  author = await invitedAccount(browser, operator, 'author', 30)
  editor = await invitedAccount(browser, operator, 'editor', 40)
})

test.afterAll(async () => {
  test.setTimeout(10_000)
  for (const page of [operator, author, editor]) await page?.context().close()
})

test('editor saves, reopens, and revises a Persian Blog Article draft', async () => {
  await openAdmin(editor)
  await editor
    .getByRole('link', { name: 'مقاله‌های وبلاگ', exact: true })
    .first()
    .click()
  await editor.getByRole('link', { name: /New/ }).click()
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('محاسبه کمیسیون کارکنان سالن')
  await editor
    .getByLabel('خلاصه', { exact: true })
    .fill('یک مثال برای تقسیم مبلغ خدمت')
  await editor
    .locator('[contenteditable="true"]')
    .first()
    .fill('سهم کارکنان با درصد توافق‌شده محاسبه می‌شود.')
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor).toHaveURL(
    /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  const id = new URL(editor.url()).pathname.split('/').at(-1)!
  const original = (await cms(editor, `content/blog_articles/${id}`)).item
  expect(original.status).toBe('draft')
  expect(blogArticleBylines(original.bylines)).toEqual(['تیم سالونا'])
  expect(original.data.summary).toBe('یک مثال برای تقسیم مبلغ خدمت')
  expect(JSON.stringify(original.data.body)).toContain('سهم کارکنان')
  await editor.reload()
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'محاسبه کمیسیون کارکنان سالن',
  )
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('محاسبه دقیق کمیسیون کارکنان سالن')
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await cms(editor, `content/blog_articles/${id}`)).item.data.title,
    )
    .toBe('محاسبه دقیق کمیسیون کارکنان سالن')
  const revised = (await cms(editor, `content/blog_articles/${id}`)).item
  expect(revised.status).toBe('draft')
  expect(revised.slug).toBe(original.slug)
  expect(revised.authorId).toBe((await cms(editor, 'auth/me')).id)
  const credentials = await cms(operator, 'admin/api-tokens', {
    name: 'Second configuration run',
    scopes: ['admin'],
  })
  await configureCmsBlog({
    url: 'http://localhost:3303',
    token: credentials.token,
  })
  expect(
    (await cms(editor, `content/blog_articles/${id}`)).item.data.title,
  ).toBe('محاسبه دقیق کمیسیون کارکنان سالن')
})

test('editor selects a named public byline without changing the editing account', async () => {
  const bylines = await cms(editor, 'admin/bylines')
  expect(
    bylines.items.map((item: { displayName: string }) => item.displayName),
  ).toContain('تیم سالونا')
  await cms(editor, 'admin/bylines', {
    slug: 'leila',
    displayName: 'لیلا رضایی',
    isGuest: true,
  })
  await editor.goto('/_emdash/admin/content/blog_articles/new')
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('نویسنده مستقل از حساب ویرایشگر')
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor).toHaveURL(
    /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  await editor
    .getByRole('button', { name: 'Choose bylines', exact: true })
    .click()
  await editor
    .getByRole('textbox', { name: 'Search bylines', exact: true })
    .fill('لیلا')
  await editor
    .getByRole('button', { name: 'Add لیلا رضایی', exact: true })
    .click()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor).toHaveURL(
    /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  const id = new URL(editor.url()).pathname.split('/').at(-1)!
  await expect
    .poll(
      async () =>
        (await cms(editor, `content/blog_articles/${id}`)).item.bylines?.[0]
          ?.byline.displayName,
    )
    .toBe('لیلا رضایی')
  const saved = (await cms(editor, `content/blog_articles/${id}`)).item
  expect(saved.bylines[0].byline.displayName).toBe('لیلا رضایی')
  expect(saved.bylines[0].source).toBe('explicit')
  expect(blogArticleBylines(saved.bylines)).toEqual(['لیلا رضایی'])
  const account = await cms(editor, 'auth/me')
  expect(saved.authorId).toBe(account.id)
  await cms(editor, 'admin/bylines', {
    slug: 'editor-identity',
    displayName: 'نام حساب ویرایشگر',
    userId: account.id,
  })
  const noCredit = await cms(editor, 'content/blog_articles', {
    slug: 'default-credit',
    status: 'draft',
    data: { title: 'اعتبار عمومی پیش‌فرض' },
  })
  const inferred = (
    await cms(editor, `content/blog_articles/${noCredit.item.id}`)
  ).item
  expect(inferred.bylines[0].source).toBe('inferred')
  expect(blogArticleBylines(inferred.bylines)).toEqual(['تیم سالونا'])
})

test('Author publishes own content; Editor manages another author without CMS administration', async () => {
  const created = await cms(author, 'content/blog_articles', {
    slug: 'author-publishing',
    status: 'draft',
    data: { title: 'انتشار توسط نویسنده' },
  })
  const id = created.item.id
  await cms(author, `content/blog_articles/${id}/publish`, {
    _rev: created._rev,
  })
  const published = await cms(author, `content/blog_articles/${id}`)
  expect(published.item.status).toBe('published')
  expect(published.item.liveRevisionId).toBeTruthy()
  await cms(
    author,
    `content/blog_articles/${id}`,
    { data: { title: 'ویرایش پیش‌نویس پس از انتشار' }, _rev: published._rev },
    'PUT',
  )
  const pending = await cms(author, `content/blog_articles/${id}`)
  expect(pending.item.status).toBe('published')
  expect(pending.item.liveRevisionId).toBe(published.item.liveRevisionId)
  expect(pending.item.draftRevisionId).not.toBe(pending.item.liveRevisionId)
  // Author cannot edit or publish another owner's article.
  const other = await cms(editor, 'content/blog_articles', {
    slug: 'editor-publishing',
    status: 'draft',
    data: { title: 'مقاله ویرایشگر' },
  })
  for (const [path, method, data] of [
    [
      `content/blog_articles/${other.item.id}`,
      'PUT',
      { data: { title: 'تغییر بدون مجوز' } },
    ],
    [`content/blog_articles/${other.item.id}/publish`, 'POST', {}],
  ] as const) {
    const denied = await author.request.fetch(`/_emdash/api/${path}`, {
      method,
      data,
      headers: { 'X-EmDash-Request': '1' },
    })
    expect(denied.status()).toBe(403)
  }
  // Locks are part of the CMS account workflow. The Editor explicitly takes
  // over the Author's lock before managing their saved content.
  await cms(
    editor,
    `content/blog_articles/${id}`,
    {
      data: { title: 'ویرایش توسط ویرایشگر دیگر' },
      _rev: pending._rev,
      overrideLock: true,
    },
    'PUT',
  )
  const edited = await cms(editor, `content/blog_articles/${id}`)
  await cms(editor, `content/blog_articles/${id}/publish`, {
    _rev: edited._rev,
    overrideLock: true,
  })
  const saved = await cms(editor, `content/blog_articles/${id}`)
  expect(saved.item.status).toBe('published')
  expect(saved.item.data.title).toBe('ویرایش توسط ویرایشگر دیگر')
  expect(saved.item.authorId).toBe((await cms(author, 'auth/me')).id)
  for (const [path, method, data] of [
    ['auth/invite', 'POST', { email: 'unauthorized@example.test', role: 50 }],
    [
      'schema/collections',
      'POST',
      { slug: 'unauthorized', label: 'Unauthorized' },
    ],
    ['settings', 'PUT', { title: 'Unauthorized' }],
    ['admin/users', 'GET', undefined],
    ['admin/plugins/nonexistent/enable', 'POST', {}],
  ] as const) {
    const denied = await editor.request.fetch(`/_emdash/api/${path}`, {
      method,
      ...(data ? { data } : {}),
      headers: { 'X-EmDash-Request': '1' },
    })
    expect([401, 403], path).toContain(denied.status())
  }
  // CMS cookies do not create a Salon session or a Salon operations route.
  expect((await editor.request.get('/api/appointments')).status()).toBe(404)
})

test('editor uploads a cover, places an inline image, and saves page SEO in the admin', async () => {
  await editor.goto('/_emdash/admin/content/blog_articles/new')
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('مقاله با تصویر و فراداده')
  await editor
    .locator('[contenteditable="true"]')
    .first()
    .fill('تصویر نمونه برای راهنمای مدیریت سالن')
  await editor
    .getByRole('button', { name: 'Select image', exact: true })
    .click()
  const picker = editor.getByRole('dialog')
  await picker.getByLabel('Choose files to upload').setInputFiles({
    name: 'cms-editor.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  // Native uploads select the completed asset automatically.
  await expect(
    picker.getByRole('button', { name: 'Select', exact: true }),
  ).toBeEnabled()
  await picker.getByRole('button', { name: 'Select', exact: true }).click()
  await expect(picker).not.toBeVisible()
  await editor
    .getByRole('button', { name: 'Insert Image', exact: true })
    .click()
  await editor
    .getByRole('dialog')
    .getByRole('button', { name: 'cms-editor.png', exact: true })
    .click()
  await editor
    .getByRole('dialog')
    .getByRole('button', { name: 'Insert image', exact: true })
    .click()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor).toHaveURL(
    /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  const id = new URL(editor.url()).pathname.split('/').at(-1)!
  await editor
    .getByLabel('SEO Title', { exact: true })
    .fill('راهنمای مدیریت سالن با تصویر')
  await editor
    .getByLabel('Meta Description', { exact: true })
    .fill('توضیحات اختصاصی این مقاله برای جستجو')
  // The native SEO panel saves its changes independently of the article body.
  await expect
    .poll(async () => {
      const seo = (await cms(editor, `content/blog_articles/${id}`)).item.seo
      return { title: seo?.title, description: seo?.description }
    })
    .toEqual({
      title: 'راهنمای مدیریت سالن با تصویر',
      description: 'توضیحات اختصاصی این مقاله برای جستجو',
    })
  const saved = (await cms(editor, `content/blog_articles/${id}`)).item
  expect(saved.status).toBe('draft')
  expect(saved.data.cover).toBeTruthy()
  expect(JSON.stringify(saved.data.body)).toContain('image')
  expect(saved.seo.description).toBe('توضیحات اختصاصی این مقاله برای جستجو')
  const media = (await cms(editor, 'media')).items
  const uploaded = media.find(
    (item: { filename: string }) => item.filename === 'cms-editor.png',
  )
  expect(uploaded.status).toBe('ready')
  expect((await editor.request.get(uploaded.url)).ok()).toBe(true)
  await editor.reload()
  await expect(editor.getByLabel('SEO Title', { exact: true })).toHaveValue(
    'راهنمای مدیریت سالن با تصویر',
  )
  await expect(
    editor.locator('[contenteditable="true"] img').first(),
  ).toBeVisible()
})
