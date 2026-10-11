import { expect, test, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  checkBlogArticle,
  checkBlogDiscovery as smokeBlogDiscovery,
  checkGuideDiscovery,
  checkProductGuide,
} from '../../scripts/smoke-blog.mjs'
import { checkCmsHealth } from '../../scripts/smoke-cms.mjs'
import { configureCmsBlog } from '../../scripts/configure-cms-blog.mjs'
import { cms, invitedAccount, openAdmin, operatorAccount } from './accounts'

test.describe.configure({ mode: 'serial' })

// Dev serves the checked-in robots file; production writes its configured origin.
const checkBlogDiscovery = (base: string, options = {}) =>
  smokeBlogDiscovery(base, {
    ...options,
    robotsOrigin:
      process.env.CMS_E2E_PRODUCTION === '1' ? base : 'http://localhost:3001',
  })

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
  await openAdmin(author)
  await openAdmin(editor)
})

test.afterAll(async () => {
  test.setTimeout(10_000)
  for (const page of [operator, author, editor]) await page?.context().close()
})

test('editor saves, reopens, and revises a Persian Blog Article draft', async () => {
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
  await editor.goto('/_emdash/admin/content/blog_articles')
  const savedTitle = editor.getByRole('link', {
    name: 'محاسبه دقیق کمیسیون کارکنان سالن',
    exact: true,
  })
  await expect(savedTitle).toHaveAttribute(
    'href',
    `/_emdash/admin/content/blog_articles/${id}?locale=en`,
  )
  await savedTitle.click()
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'محاسبه دقیق کمیسیون کارکنان سالن',
  )
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
  const profile = await cms(editor, 'content/public_authors', {
    slug: 'leila',
    status: 'draft',
    data: { title: 'لیلا رضایی' },
  })
  await cms(editor, `content/public_authors/${profile.item.id}/publish`, {})
  await editor.goto('/_emdash/admin/content/blog_articles/new')
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('نویسنده مستقل از حساب ویرایشگر')
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor).toHaveURL(
    /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  await editor
    .getByRole('button', { name: 'Add reference', exact: true })
    .click()
  await editor
    .getByRole('dialog')
    .getByText('لیلا رضایی', { exact: true })
    .click()
  await editor
    .getByRole('dialog')
    .getByRole('button', { name: 'Add selected', exact: true })
    .click()
  await expect(editor.getByRole('dialog')).not.toBeVisible()
  const id = new URL(editor.url()).pathname.split('/').at(-1)!
  const [response] = await Promise.all([
    editor.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname.endsWith(`/blog_articles/${id}`),
    ),
    editor.getByRole('button', { name: 'Save', exact: true }).click(),
  ])
  expect(response.ok()).toBe(true)
  const preview = (
    await cms(editor, `content/blog_articles/${id}/preview-url`, {})
  ).url
  expect(await (await editor.request.get(preview)).text()).toContain(
    'لیلا رضایی',
  )
  const saved = (await cms(editor, `content/blog_articles/${id}`)).item
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
  await cms(editor, `content/blog_articles/${noCredit.item.id}/publish`, {})
  const publicHtml = await (
    await editor.request.get('/blog/default-credit')
  ).text()
  expect(publicHtml).toContain('تیم سالونا')
  expect(publicHtml).not.toContain('نام حساب ویرایشگر')
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
  const listing = await cms(author, 'content/blog_articles')
  expect(
    listing.items.find((item: { id: string }) => item.id === id).data.title,
  ).toBe('ویرایش پیش‌نویس پس از انتشار')
  expect(
    listing.items.find((item: { id: string }) => item.id === id).status,
  ).toBe('published')
  const publicHtml = await (
    await author.request.get('/blog/author-publishing')
  ).text()
  expect(publicHtml).toContain('انتشار توسط نویسنده')
  expect(publicHtml).not.toContain('ویرایش پیش‌نویس پس از انتشار')
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
    ['settings', 'POST', { title: 'Unauthorized' }],
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
  await expect(editor.getByLabel('SEO Title', { exact: true })).toHaveCount(0)
  await editor
    .getByLabel(/^عنوان برای جستجو/)
    .fill('راهنمای مدیریت سالن با تصویر')
  await editor
    .getByLabel(/^توضیح برای جستجو/)
    .fill('توضیحات اختصاصی این مقاله برای جستجو')
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  // Search fields are saved with the article revision.
  await expect
    .poll(async () => {
      const data = (await cms(editor, `content/blog_articles/${id}`)).item.data
      return { title: data.seo_title, description: data.seo_description }
    })
    .toEqual({
      title: 'راهنمای مدیریت سالن با تصویر',
      description: 'توضیحات اختصاصی این مقاله برای جستجو',
    })
  const saved = (await cms(editor, `content/blog_articles/${id}`)).item
  expect(saved.status).toBe('draft')
  expect(saved.data.cover).toBeTruthy()
  expect(JSON.stringify(saved.data.body)).toContain('image')
  expect(saved.data.seo_description).toBe(
    'توضیحات اختصاصی این مقاله برای جستجو',
  )
  const media = (await cms(editor, 'media')).items
  const uploaded = media.find(
    (item: { filename: string }) => item.filename === 'cms-editor.png',
  )
  expect(uploaded.status).toBe('ready')
  expect((await editor.request.get(uploaded.url)).ok()).toBe(true)
  await editor.reload()
  await expect(editor.getByLabel(/^عنوان برای جستجو/)).toHaveValue(
    'راهنمای مدیریت سالن با تصویر',
  )
  await expect(
    editor.locator('[contenteditable="true"] img').first(),
  ).toBeVisible()
})

test('visitors read published Persian articles, public credit, and signup links', async ({
  page,
}) => {
  const created = await cms(editor, 'content/blog_articles', {
    slug: 'staff-commission-guide',
    status: 'draft',
    data: {
      title: 'کمیسیون کارکنان سالن چگونه محاسبه می‌شود؟',
      summary: 'یک مثال روشن برای تقسیم مبلغ خدمت بین سالن و همکاران.',
      body: [
        {
          _type: 'block',
          _key: 'heading',
          style: 'h2',
          children: [
            {
              _type: 'span',
              _key: 's1',
              text: 'مبنای محاسبه را مشخص کنید',
              marks: [],
            },
          ],
          markDefs: [],
        },
        {
          _type: 'block',
          _key: 'text',
          style: 'normal',
          children: [
            {
              _type: 'span',
              _key: 's2',
              text: 'برای یک خدمت یک میلیون تومانی با کمیسیون سی درصد، سهم همکار سیصد هزار تومان است.',
              marks: [],
            },
          ],
          markDefs: [],
        },
      ],
    },
  })
  await cms(editor, `content/blog_articles/${created.item.id}/publish`, {
    _rev: created._rev,
  })
  const live = await cms(editor, `content/blog_articles/${created.item.id}`)
  await cms(
    editor,
    `content/blog_articles/${created.item.id}`,
    { data: { title: 'عنوان ویرایش‌شده در پیش‌نویس' }, _rev: live._rev },
    'PUT',
  )
  await editor
    .context()
    .addCookies([
      { name: 'emdash-edit-mode', value: 'true', url: 'http://localhost:3303' },
    ])
  const signedInPublic = await editor.request.get(
    '/blog/staff-commission-guide',
  )
  expect(await signedInPublic.text()).not.toContain(
    'عنوان ویرایش‌شده در پیش‌نویس',
  )
  await editor.context().clearCookies({ name: 'emdash-edit-mode' })
  const response = await page.goto('/blog/staff-commission-guide')
  expect(response!.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'کمیسیون کارکنان سالن چگونه محاسبه می‌شود؟',
  )
  await expect(
    page.getByRole('heading', { name: 'مبنای محاسبه را مشخص کنید' }),
  ).toBeVisible()
  await expect(page.locator('article')).toContainText('سیصد هزار تومان')
  await expect(page.locator('article')).toContainText('تیم سالونا')
  await expect(page.locator('article')).not.toContainText('نام حساب ویرایشگر')
  await expect(page.locator('article img')).toHaveCount(0)
  const signup = page.getByRole('link', {
    name: 'شروع استفاده از سالونا',
    exact: true,
  })
  expect(new URL((await signup.getAttribute('href'))!).pathname).toBe('/signup')
  await expect(page.locator('header nav a[href="/blog"]')).toBeVisible()
  await page
    .locator('astro-dev-toolbar')
    .evaluateAll((toolbars) => toolbars.forEach((toolbar) => toolbar.remove()))
  await page.screenshot({
    path: test.info().outputPath('blog-article-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('blog-article-mobile.png'),
    fullPage: true,
  })
  const index = await page.request.get('/blog')
  expect(index.status()).toBe(200)
  const html = await index.text()
  expect(html).toContain('کمیسیون کارکنان سالن چگونه محاسبه می‌شود؟')
  expect(html).not.toContain('محاسبه دقیق کمیسیون کارکنان سالن')
  expect((await page.request.get('/blog/default-credit')).status()).toBe(200)
  expect((await page.request.get('/blog/not-a-real-article')).status()).toBe(
    404,
  )
})

test('published named credit and CMS images render without changing the writing account', async ({
  page,
}) => {
  const items = (await cms(editor, 'content/blog_articles')).items
  const imageArticle = items.find(
    (item: { data: { title: string } }) =>
      item.data.title === 'مقاله با تصویر و فراداده',
  )
  const credits = (await cms(editor, 'content/public_authors')).items
  const leila = credits.find(
    (profile: { slug: string }) => profile.slug === 'leila',
  )
  const saved = await cms(editor, `content/blog_articles/${imageArticle.id}`)
  await cms(
    editor,
    `content/blog_articles/${imageArticle.id}`,
    { data: {}, references: { public_authors: [leila.id] }, _rev: saved._rev },
    'PUT',
  )
  const credited = await cms(editor, `content/blog_articles/${imageArticle.id}`)
  await cms(editor, `content/blog_articles/${imageArticle.id}/publish`, {
    _rev: credited._rev,
  })
  await page.goto(`/blog/${encodeURIComponent(credited.item.slug)}`)
  await expect(page.locator('article')).toContainText('لیلا رضایی')
  const metadata = await checkBlogArticle(page.url())
  expect(metadata.author).toEqual([{ '@type': 'Person', name: 'لیلا رضایی' }])
  expect(metadata.image).not.toContain('/og/landing.png')
  await expect(page.locator('article img')).toHaveCount(2)
  for (const image of await page.locator('article img').all()) {
    expect(
      (await page.request.get((await image.getAttribute('src'))!)).ok(),
    ).toBe(true)
    await expect(image).toBeVisible()
  }
})

test('a signed preview requires a real content session and never leaks into anonymous responses', async ({
  browser,
  page,
}) => {
  const contributor = await invitedAccount(browser, operator, 'contributor', 20)
  const subscriber = await invitedAccount(browser, operator, 'subscriber', 10)
  try {
    const listed = await cms(operator, 'content/blog_articles', {
      slug: 'draft-title-visibility',
      status: 'draft',
      data: { title: 'عنوان منتشرشده در فهرست' },
    })
    await cms(operator, `content/blog_articles/${listed.item.id}/publish`, {})
    await cms(
      operator,
      `content/blog_articles/${listed.item.id}`,
      { data: { title: 'عنوان خصوصی تازه در فهرست' } },
      'PUT',
    )
    const subscriberList = await cms(subscriber, 'content/blog_articles')
    expect(
      subscriberList.items.find(
        (item: { id: string }) => item.id === listed.item.id,
      ).data.title,
    ).toBe('عنوان منتشرشده در فهرست')
    expect(JSON.stringify(subscriberList)).not.toContain(
      'عنوان خصوصی تازه در فهرست',
    )
    const contributorList = await cms(contributor, 'content/blog_articles')
    expect(
      contributorList.items.find(
        (item: { id: string }) => item.id === listed.item.id,
      ).data.title,
    ).toBe('عنوان خصوصی تازه در فهرست')
    const draft = await cms(contributor, 'content/blog_articles', {
      slug: 'private-draft-preview',
      status: 'draft',
      data: {
        title: 'پیش‌نویس خصوصی برنامه همکاران',
        summary: 'این متن هنوز برای انتشار آماده نیست.',
      },
    })
    const link = (
      await cms(
        contributor,
        `content/blog_articles/${draft.item.id}/preview-url`,
        {},
      )
    ).url
    const preview = await contributor.goto(link)
    expect(preview!.status()).toBe(200)
    await expect(contributor.getByRole('heading', { level: 1 })).toHaveText(
      'پیش‌نویس خصوصی برنامه همکاران',
    )
    await expect(contributor.locator('#emdash-toolbar')).toHaveCount(0)
    await expect(
      contributor.getByText('پیش‌نمایش پیش‌نویس', { exact: true }),
    ).toBeVisible()
    expect(preview!.headers()['cache-control']).toContain('private, no-store')
    expect(preview!.headers()['x-robots-tag']).toContain('noindex')
    await checkBlogDiscovery('http://localhost:3303', {
      absent: ['private-draft-preview'],
    })
    await expect(contributor.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    )
    const copied = await page.request.get(link)
    expect(copied.status()).toBe(403)
    expect(await copied.text()).not.toContain('پیش‌نویس خصوصی برنامه همکاران')
    expect(copied.headers()['cache-control']).toContain('private, no-store')
    expect(copied.headers()['x-robots-tag']).toContain('noindex')
    expect((await subscriber.request.get(link)).status()).toBe(403)
    const invalid = await contributor.request.get(
      '/blog/staff-commission-guide?_preview=invalid',
    )
    expect(invalid.status()).toBe(404)
    expect(invalid.headers()['cache-control']).toContain('private, no-store')
    expect(invalid.headers()['x-robots-tag']).toContain('noindex')
    const unknown = await contributor.request.get(
      '/blog/unknown/nested?_preview=invalid',
    )
    expect(unknown.status()).toBe(404)
    expect(unknown.headers()['cache-control']).toContain('private, no-store')
    expect(unknown.headers()['x-robots-tag']).toContain('noindex')
    const token = new URL(link, 'http://localhost:3303').searchParams.get(
      '_preview',
    )!
    await contributor.context().addCookies([
      {
        name: 'emdash-edit-mode',
        value: 'true',
        url: 'http://localhost:3303',
      },
    ])
    const wrongEntry = await contributor.request.get(
      `/blog/staff-commission-guide?_preview=${encodeURIComponent(token)}`,
    )
    expect(wrongEntry.status()).toBe(404)
    const expiredLink = (
      await cms(
        contributor,
        `content/blog_articles/${draft.item.id}/preview-url`,
        { expiresIn: -1 },
      )
    ).url
    const expired = await contributor.request.get(expiredLink)
    expect(expired.status()).toBe(404)
    expect(expired.headers()['cache-control']).toContain('private, no-store')
    expect(expired.headers()['x-robots-tag']).toContain('noindex')
    expect(
      (await page.request.get('/blog/private-draft-preview')).status(),
    ).toBe(404)
    expect(await (await page.request.get('/blog')).text()).not.toContain(
      'پیش‌نویس خصوصی برنامه همکاران',
    )
    expect(
      await (await page.request.get('/blog/staff-commission-guide')).text(),
    ).not.toContain('پیش‌نویس خصوصی برنامه همکاران')
  } finally {
    await contributor.context().close()
    await subscriber.context().close()
  }
})

test('an Author illustrates, previews, publishes, revises, republishes, and withdraws an article without a rebuild', async ({
  page,
}) => {
  await author.goto('/_emdash/admin/content/blog_articles/new')
  await author
    .getByLabel('عنوان', { exact: true })
    .fill('برنامه روزانه نوبت‌های سالن')
  await author
    .getByLabel('خلاصه', { exact: true })
    .fill('درخواست‌های نوبت را در ابتدای روز بررسی کنید.')
  await author
    .locator('[contenteditable="true"]')
    .first()
    .fill('درخواست نوبت با نوبت تأییدشده تفاوت دارد.')
  await author
    .getByRole('button', { name: 'Select image', exact: true })
    .click()
  const picker = author.getByRole('dialog')
  await picker.getByLabel('Choose files to upload').setInputFiles({
    name: 'appointment-requests.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(
    picker.getByRole('button', { name: 'Select', exact: true }),
  ).toBeEnabled()
  await picker.getByRole('button', { name: 'Select', exact: true }).click()
  await author.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(author).toHaveURL(
    /content\/blog_articles\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  const id = new URL(author.url()).pathname.split('/').at(-1)!
  const original = (await cms(author, `content/blog_articles/${id}`)).item
  const publicPath = `/blog/${encodeURIComponent(original.slug)}`
  const previewDraft = async (title: string, body: string) => {
    const [preview] = await Promise.all([
      author.context().waitForEvent('page'),
      author
        .getByRole('button', { name: /^Preview(?: draft)?$/, exact: true })
        .first()
        .click(),
    ])
    await expect(preview.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(preview.locator('article')).toContainText(body)
    await expect(preview.locator('article img')).toHaveCount(1)
    expect(
      (
        await preview.request.get(
          (await preview.locator('article img').getAttribute('src'))!,
        )
      ).ok(),
    ).toBe(true)
    await expect(
      preview.getByText('پیش‌نمایش پیش‌نویس', { exact: true }),
    ).toBeVisible()
    await preview.close()
  }
  const publish = async (label: string) => {
    await author
      .getByRole('button', { name: label, exact: true })
      .first()
      .click()
    const [response] = await Promise.all([
      author.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith(`/blog_articles/${id}/publish`) &&
          r.request().method() === 'POST',
      ),
      author
        .getByRole('dialog')
        .getByRole('button', { name: label, exact: true })
        .click(),
    ])
    expect(response.ok()).toBe(true)
  }
  await previewDraft('برنامه روزانه نوبت‌های سالن', 'نوبت تأییدشده')
  expect((await page.request.get(publicPath)).status()).toBe(404)
  await publish('Publish now')
  const first = await page.goto(publicPath)
  expect(first!.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'برنامه روزانه نوبت‌های سالن',
  )
  await expect(page.locator('article')).toContainText('نوبت تأییدشده')
  expect(await (await page.request.get('/blog')).text()).toContain(
    'برنامه روزانه نوبت‌های سالن',
  )
  await author
    .getByLabel('عنوان', { exact: true })
    .fill('رسیدگی روزانه به درخواست‌های نوبت')
  await author
    .locator('[contenteditable="true"]')
    .first()
    .fill('ابتدا درخواست‌های تازه را بررسی و سپس نوبت را ثبت کنید.')
  await author.getByRole('button', { name: 'Save', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await cms(author, `content/blog_articles/${id}`)).item.data.title,
    )
    .toBe('رسیدگی روزانه به درخواست‌های نوبت')
  expect((await cms(author, `content/blog_articles/${id}`)).item.slug).toBe(
    original.slug,
  )
  await previewDraft(
    'رسیدگی روزانه به درخواست‌های نوبت',
    'ابتدا درخواست‌های تازه',
  )
  const liveDraft = await page.request.get(publicPath)
  expect(liveDraft.status()).toBe(200)
  const html = await liveDraft.text()
  expect(html).toContain('برنامه روزانه نوبت‌های سالن')
  expect(html).toContain('نوبت تأییدشده')
  expect(html).not.toContain('رسیدگی روزانه به درخواست‌های نوبت')
  expect(html).not.toContain('ابتدا درخواست‌های تازه')
  await publish('Publish changes')
  const republished = await page.request.get(publicPath)
  expect(republished.status()).toBe(200)
  expect(await republished.text()).toContain('ابتدا درخواست‌های تازه')
  expect(await (await page.request.get('/blog')).text()).toContain(
    'رسیدگی روزانه به درخواست‌های نوبت',
  )
  await expect(
    author.getByRole('button', { name: /^Unpublish / }).first(),
  ).toBeVisible()
  const [withdrawn] = await Promise.all([
    author.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith(`/blog_articles/${id}/unpublish`) &&
        r.request().method() === 'POST',
    ),
    author
      .getByRole('button', { name: /^Unpublish / })
      .first()
      .click(),
  ])
  expect(withdrawn.ok()).toBe(true)
  expect((await page.request.get(publicPath)).status()).toBe(404)
  expect(await (await page.request.get('/blog')).text()).not.toContain(
    'رسیدگی روزانه به درخواست‌های نوبت',
  )
})

test('published Blog Article slash variants permanently redirect to the current canonical URL', async ({
  page,
}) => {
  const created = await cms(author, 'content/blog_articles', {
    slug: 'canonical-blog-path',
    status: 'draft',
    data: { title: 'نشانی ثابت مقاله' },
  })
  await cms(author, `content/blog_articles/${created.item.id}/publish`, {
    _rev: created._rev,
  })
  for (const [path, canonical] of [
    ['/blog/', '/blog'],
    ['/blog/canonical-blog-path/', '/blog/canonical-blog-path'],
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 })
    expect([301, 308]).toContain(response.status())
    expect(response.headers().location).toBe(canonical)
    expect(response.headers()['cache-control']).toContain('no-store')
  }
  expect(
    (
      await page.request.get('/blog/not-a-blog-article/', { maxRedirects: 0 })
    ).status(),
  ).toBe(404)
})

test('published slug changes remain private until publishing and former URLs disappear on withdrawal', async ({
  page,
}) => {
  const created = await cms(author, 'content/blog_articles', {
    slug: 'stable-article-first',
    status: 'draft',
    data: { title: 'راهنمای نشانی پایدار مقاله' },
  })
  const id = created.item.id
  const discovery = (present: string[], absent: string[]) =>
    checkBlogDiscovery('http://localhost:3303', { present, absent })
  await discovery([], ['stable-article-first'])
  await cms(editor, `content/blog_articles/${id}/publish`, {
    _rev: created._rev,
    overrideLock: true,
  })
  expect((await page.request.get('/blog/stable-article-first')).status()).toBe(
    200,
  )
  expect(await (await page.request.get('/blog')).text()).toContain(
    '/blog/stable-article-first',
  )
  const firstMetadata = await checkBlogArticle(
    'http://localhost:3303/blog/stable-article-first',
  )
  await discovery(['stable-article-first'], ['stable-article-second'])
  const live = await cms(editor, `content/blog_articles/${id}`)
  await cms(
    editor,
    `content/blog_articles/${id}`,
    {
      slug: 'stable-article-second',
      data: { title: 'عنوان پیش‌نویس با نشانی تازه' },
      _rev: live._rev,
    },
    'PUT',
  )
  const previewLink = (
    await cms(editor, `content/blog_articles/${id}/preview-url`, {})
  ).url
  const preview = await editor.request.get(previewLink)
  expect(preview.status()).toBe(200)
  expect(await preview.text()).toContain('عنوان پیش‌نویس با نشانی تازه')
  expect(preview.headers()['x-robots-tag']).toContain('noindex')
  const beforeRename = await page.request.get('/blog/stable-article-first', {
    maxRedirects: 0,
  })
  expect(beforeRename.status()).toBe(200)
  expect(await beforeRename.text()).toContain('راهنمای نشانی پایدار مقاله')
  expect(
    (
      await page.request.get('/blog/stable-article-second', { maxRedirects: 0 })
    ).status(),
  ).toBe(404)
  expect(await (await page.request.get('/blog')).text()).not.toContain(
    '/blog/stable-article-second',
  )
  expect(
    (await checkBlogArticle('http://localhost:3303/blog/stable-article-first'))
      .dateModified,
  ).toBe(firstMetadata.dateModified)
  await discovery(['stable-article-first'], ['stable-article-second'])
  let pending = await cms(editor, `content/blog_articles/${id}`)
  await cms(editor, `content/blog_articles/${id}/publish`, {
    _rev: pending._rev,
  })
  const firstRename = await page.request.get('/blog/stable-article-first', {
    maxRedirects: 0,
  })
  expect([301, 308]).toContain(firstRename.status())
  expect(firstRename.headers().location).toBe('/blog/stable-article-second')
  expect((await page.request.get('/blog/stable-article-second')).status()).toBe(
    200,
  )
  expect(await (await page.request.get('/blog')).text()).toContain(
    '/blog/stable-article-second',
  )
  await discovery(['stable-article-second'], ['stable-article-first'])
  const renamedMetadata = await checkBlogArticle(
    'http://localhost:3303/blog/stable-article-second',
  )
  expect(renamedMetadata.datePublished).toBe(firstMetadata.datePublished)
  expect(renamedMetadata.dateModified).not.toBe(firstMetadata.dateModified)
  pending = await cms(editor, `content/blog_articles/${id}`)
  await cms(
    editor,
    `content/blog_articles/${id}`,
    { slug: 'stable-article-third', data: {}, _rev: pending._rev },
    'PUT',
  )
  pending = await cms(editor, `content/blog_articles/${id}`)
  const publishedThird = await cms(
    editor,
    `content/blog_articles/${id}/publish`,
    {
      _rev: pending._rev,
    },
  )
  expect(publishedThird.item.slug).toBe('stable-article-third')
  expect((await page.request.get('/blog/stable-article-third')).status()).toBe(
    200,
  )
  for (const former of ['stable-article-first', 'stable-article-second']) {
    for (const suffix of ['', '/']) {
      const response = await page.request.get(`/blog/${former}${suffix}`, {
        maxRedirects: 0,
      })
      expect([301, 308]).toContain(response.status())
      expect(response.headers().location).toBe('/blog/stable-article-third')
    }
  }
  await discovery(
    ['stable-article-third'],
    ['stable-article-first', 'stable-article-second'],
  )
  await checkBlogArticle('http://localhost:3303/blog/stable-article-third')
  const currentPreview = (
    await cms(editor, `content/blog_articles/${id}/preview-url`, {})
  ).url
  const expiredPreview = (
    await cms(editor, `content/blog_articles/${id}/preview-url`, {
      expiresIn: -1,
    })
  ).url
  for (const search of [
    new URL(currentPreview, 'http://localhost:3303').search,
    '?_preview=invalid',
    new URL(expiredPreview, 'http://localhost:3303').search,
  ]) {
    for (const session of [editor, page]) {
      const formerPreview = await session.request.get(
        `/blog/stable-article-first${search}`,
        { maxRedirects: 0 },
      )
      expect([403, 404]).toContain(formerPreview.status())
      expect(formerPreview.headers()['cache-control']).toContain(
        'private, no-store',
      )
      expect(formerPreview.headers()['x-robots-tag']).toContain('noindex')
      expect(await formerPreview.text()).not.toContain(
        'عنوان پیش‌نویس با نشانی تازه',
      )
    }
  }
  pending = await cms(editor, `content/blog_articles/${id}`)
  await cms(editor, `content/blog_articles/${id}/unpublish`, {
    _rev: pending._rev,
  })
  for (const slug of [
    'stable-article-first',
    'stable-article-second',
    'stable-article-third',
  ]) {
    for (const suffix of ['', '/'])
      expect(
        (
          await page.request.get(`/blog/${slug}${suffix}`, { maxRedirects: 0 })
        ).status(),
      ).toBe(404)
  }
  await discovery(
    [],
    ['stable-article-first', 'stable-article-second', 'stable-article-third'],
  )
  expect(await (await page.request.get('/blog')).text()).not.toContain(
    'عنوان پیش‌نویس با نشانی تازه',
  )
  pending = await cms(editor, `content/blog_articles/${id}`)
  await cms(editor, `content/blog_articles/${id}/publish`, {
    _rev: pending._rev,
  })
  expect((await page.request.get('/blog/stable-article-third')).status()).toBe(
    200,
  )
  await discovery(
    ['stable-article-third'],
    ['stable-article-first', 'stable-article-second'],
  )
  await cms(editor, `content/blog_articles/${id}`, undefined, 'DELETE')
  await discovery(
    [],
    ['stable-article-first', 'stable-article-second', 'stable-article-third'],
  )
  for (const slug of [
    'stable-article-first',
    'stable-article-second',
    'stable-article-third',
  ]) {
    expect(
      (await page.request.get(`/blog/${slug}`, { maxRedirects: 0 })).status(),
    ).toBe(404)
  }
  await cms(
    operator,
    `content/blog_articles/${id}/permanent`,
    undefined,
    'DELETE',
  )
  expect(
    (
      await page.request.get('/blog/stable-article-first', { maxRedirects: 0 })
    ).status(),
  ).toBe(404)
  await discovery(
    [],
    ['stable-article-first', 'stable-article-second', 'stable-article-third'],
  )
  expect(await (await page.request.get('/blog')).text()).not.toContain(
    'عنوان پیش‌نویس با نشانی تازه',
  )
})

test('former Blog Article URLs remain correct when automatic redirects span multiple pages', async ({
  page,
}) => {
  const created = await cms(author, 'content/blog_articles', {
    slug: 'paged-redirect',
    status: 'draft',
    data: { title: 'مقاله با چند تغییر نشانی' },
  })
  const id = created.item.id
  let saved = await cms(author, `content/blog_articles/${id}/publish`, {
    _rev: created._rev,
  })
  for (let rename = 1; rename <= 101; rename++) {
    saved = await cms(
      author,
      `content/blog_articles/${id}`,
      { slug: `paged-redirect-${rename}`, data: {}, _rev: saved._rev },
      'PUT',
    )
    saved = await cms(author, `content/blog_articles/${id}/publish`, {
      _rev: saved._rev,
    })
  }
  const oldest = await page.request.get('/blog/paged-redirect', {
    maxRedirects: 0,
  })
  expect(oldest.status()).toBe(301)
  expect(oldest.headers().location).toBe('/blog/paged-redirect-101')
  await cms(author, `content/blog_articles/${id}/unpublish`, {
    _rev: saved._rev,
  })
  expect(
    (
      await page.request.get('/blog/paged-redirect', { maxRedirects: 0 })
    ).status(),
  ).toBe(404)
})

test('production public pages keep canonical metadata and slash redirects with query parameters', async ({
  page,
}) => {
  test.skip(
    process.env.CMS_E2E_PRODUCTION !== '1',
    'Static redirect behavior is handled by the production Node adapter',
  )
  for (const path of [
    '/services',
    '/about',
    '/features/online-appointment-requests',
  ]) {
    const variant = await page.request.get(`${path}/?campaign=seo%20check`, {
      maxRedirects: 0,
    })
    expect([301, 308]).toContain(variant.status())
    expect(
      new URL(variant.headers().location, 'http://localhost:3303').pathname,
    ).toBe(path)
    expect(
      new URL(variant.headers().location, 'http://localhost:3303').search,
    ).toBe('?campaign=seo%20check')
    const existingPage = await page.request.get(path)
    expect(existingPage.status()).toBe(200)
    expect(await existingPage.text()).toContain(
      `rel="canonical" href="http://localhost:3303${path}"`,
    )
    expect(await existingPage.text()).not.toContain(
      '<meta http-equiv="refresh"',
    )
  }
  const sitemap = await page.request.get('/sitemap-0.xml')
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).toContain(
    '<loc>http://localhost:3303/about</loc>',
  )
  const robots = await page.request.get('/robots.txt')
  expect(await robots.text()).toContain(
    'Sitemap: http://localhost:3303/sitemap-index.xml',
  )
  expect(await robots.text()).toContain(
    'Sitemap: http://localhost:3303/salons-sitemap.xml',
  )
})

test('saving public credit and SEO changes keeps the published presentation until republishing', async ({
  page,
}) => {
  const profile = (
    await cms(editor, 'content/public_authors', {
      slug: 'staged-credit',
      status: 'draft',
      data: { title: 'نویسنده پیش‌نویس' },
    })
  ).item
  await cms(editor, `content/public_authors/${profile.id}/publish`, {})
  const legacyCredit = await cms(editor, 'admin/bylines', {
    slug: 'legacy-credit',
    displayName: 'اعتبار قدیمی غیرعمومی',
    isGuest: true,
  })
  const created = await cms(editor, 'content/blog_articles', {
    slug: 'staged-presentation',
    status: 'draft',
    data: {
      title: 'مقاله منتشرشده با اعتبار ثابت',
      seo_title: 'عنوان جستجوی منتشرشده',
      seo_description: 'توضیح جستجوی منتشرشده',
    },
  })
  await cms(editor, `content/blog_articles/${created.item.id}/publish`, {
    _rev: created._rev,
  })
  const beforeDraft = await checkBlogArticle(
    'http://localhost:3303/blog/staged-presentation',
  )
  const current = await cms(editor, `content/blog_articles/${created.item.id}`)
  await cms(
    editor,
    `content/blog_articles/${created.item.id}`,
    {
      data: {
        title:
          'عنوان مقاله پیش‌نویس </script><script id="cms-injection">alert(1)</script>',
        seo_title: 'عنوان جستجوی پیش‌نویس',
        seo_description: 'توضیح جستجوی پیش‌نویس',
        search_excluded: true,
      },
      references: { public_authors: [profile.id] },
      bylines: [{ bylineId: legacyCredit.id }],
      _rev: current._rev,
    },
    'PUT',
  )
  const live = await (
    await page.request.get('/blog/staged-presentation')
  ).text()
  expect(live.includes('نویسنده پیش‌نویس')).toBe(false)
  expect(live).not.toContain('اعتبار قدیمی غیرعمومی')
  expect(live.includes('<title>عنوان جستجوی منتشرشده')).toBe(true)
  expect(live.includes('content="noindex')).toBe(false)
  await editor
    .context()
    .addCookies([
      { name: 'emdash-edit-mode', value: 'true', url: 'http://localhost:3303' },
    ])
  expect(
    await (await editor.request.get('/blog-sitemap.xml')).text(),
  ).toContain('/blog/staged-presentation')
  await editor.context().clearCookies({ name: 'emdash-edit-mode' })
  expect(
    (await checkBlogArticle('http://localhost:3303/blog/staged-presentation'))
      .dateModified,
  ).toBe(beforeDraft.dateModified)
  const preview = (
    await cms(
      editor,
      `content/blog_articles/${created.item.id}/preview-url`,
      {},
    )
  ).url
  await editor.goto(preview)
  await expect(editor.locator('article')).toContainText('نویسنده پیش‌نویس')
  expect(await editor.title()).toContain('عنوان جستجوی پیش‌نویس')
  const sitemap = await page.request.get('/blog-sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect((await sitemap.text()).includes('/blog/staged-presentation')).toBe(
    true,
  )
  const pending = await cms(editor, `content/blog_articles/${created.item.id}`)
  await cms(editor, `content/blog_articles/${created.item.id}/publish`, {
    _rev: pending._rev,
  })
  const republished = await (
    await page.request.get('/blog/staged-presentation')
  ).text()
  expect(republished.includes('نویسنده پیش‌نویس')).toBe(true)
  expect(republished.includes('<title>عنوان جستجوی پیش‌نویس')).toBe(true)
  expect(republished.includes('content="noindex')).toBe(true)
  expect(republished).not.toContain('<script id="cms-injection">')
  const afterPublish = await checkBlogArticle(
    'http://localhost:3303/blog/staged-presentation',
  )
  expect(afterPublish.headline).toContain(
    '</script><script id="cms-injection">',
  )
  expect(afterPublish.datePublished).toBe(beforeDraft.datePublished)
  expect(afterPublish.dateModified).not.toBe(beforeDraft.dateModified)
  expect(
    (await (await page.request.get('/blog-sitemap.xml')).text()).includes(
      '/blog/staged-presentation',
    ),
  ).toBe(false)
})

test('public author profiles use their published names and never expose profile drafts', async ({
  page,
}) => {
  const profile = await cms(editor, 'content/public_authors', {
    slug: 'independent-profile',
    status: 'draft',
    data: { title: 'نام عمومی منتشرشده' },
  })
  const article = await cms(editor, 'content/blog_articles', {
    slug: 'independent-profile-article',
    status: 'draft',
    data: { title: 'اعتبار عمومی با پروفایل مستقل' },
    references: { public_authors: [profile.item.id] },
  })
  await cms(editor, `content/blog_articles/${article.item.id}/publish`, {})
  expect(
    (
      await checkBlogArticle(
        'http://localhost:3303/blog/independent-profile-article',
      )
    ).author,
  ).toEqual([{ '@type': 'Person', name: 'تیم سالونا' }])
  await cms(editor, `content/public_authors/${profile.item.id}/publish`, {})
  expect(
    (
      await checkBlogArticle(
        'http://localhost:3303/blog/independent-profile-article',
      )
    ).author,
  ).toEqual([{ '@type': 'Person', name: 'نام عمومی منتشرشده' }])
  const current = await cms(editor, `content/public_authors/${profile.item.id}`)
  await cms(
    editor,
    `content/public_authors/${profile.item.id}`,
    { data: { title: 'نام عمومی پیش‌نویس' }, _rev: current._rev },
    'PUT',
  )
  const html = await (
    await page.request.get('/blog/independent-profile-article')
  ).text()
  expect(html).toContain('نام عمومی منتشرشده')
  expect(html).not.toContain('نام عمومی پیش‌نویس')
  const preview = (
    await cms(
      editor,
      `content/blog_articles/${article.item.id}/preview-url`,
      {},
    )
  ).url
  const previewHtml = await (await editor.request.get(preview)).text()
  expect(previewHtml).toContain('نام عمومی منتشرشده')
  expect(previewHtml).not.toContain('نام عمومی پیش‌نویس')
  await checkBlogDiscovery('http://localhost:3303', {
    present: ['independent-profile-article'],
    absent: ['independent-profile'],
  })
})

test('production smoke detects missing editor styles while the landing page stays healthy', async ({
  page,
}) => {
  test.skip(
    process.env.CMS_E2E_PRODUCTION !== '1',
    'Requires built production assets',
  )
  const admin = await page.request.get('/_emdash/admin')
  const href = (await admin.text()).match(
    /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/,
  )?.[1]
  expect(href).toBeTruthy()
  const assetPath = new URL(href!, 'http://localhost:3303').pathname
  expect(assetPath).toMatch(/^\/_astro\/[^/]+\.css$/)
  const file = resolve('apps/web/dist/client', `.${assetPath}`)
  await checkCmsHealth('http://localhost:3303')
  await rename(file, `${file}.cms-missing`)
  try {
    expect((await page.request.get('/')).status()).toBe(200)
    expect((await page.request.get(assetPath)).status()).toBe(404)
    await expect(checkCmsHealth('http://localhost:3303')).rejects.toThrow()
  } finally {
    await rename(`${file}.cms-missing`, file)
  }
  await checkCmsHealth('http://localhost:3303')
})

test('an Editor maintains an illustrated Persian Product Guide through native publication and private preview', async ({
  page,
}) => {
  const related = await cms(editor, 'content/product_guides', {
    slug: 'related-guide',
    status: 'draft',
    data: { title: 'راهنمای مرتبط منتشرشده' },
  })
  await cms(editor, `content/product_guides/${related.item.id}/publish`, {})
  await editor.goto('/_emdash/admin/content/product_guides/new')
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('افزودن مشتری در سالونا')
  await editor
    .getByLabel('خلاصه', { exact: true })
    .fill('نام و شماره مشتری را در بخش مشتریان ثبت کنید.')
  const body = editor.locator('[contenteditable="true"]').first()
  await body.fill('مشتری جدید را انتخاب کنید.')
  await editor
    .getByRole('button', { name: 'Numbered List', exact: true })
    .click()
  await body.press('End')
  await body.press('Enter')
  await body.pressSequentially('نام و شماره را وارد کنید.')
  await editor.getByLabel('مسئول بازبینی').fill('تیم محصول سالونا')
  await editor
    .getByLabel('پیوند ویدئوی بیرونی')
    .fill('https://www.youtube.com/watch?v=jNQXAC9IVRw')
  await editor
    .getByLabel('متن همراه ویدئو')
    .fill(
      'این ویدئو نمونه فنی پخش است؛ مراحل همین راهنما مستقل از ویدئو قابل خواندن‌اند.',
    )
  await editor
    .getByRole('button', { name: 'Select image', exact: true })
    .click()
  const picker = editor.getByRole('dialog')
  await picker.getByLabel('Choose files to upload').setInputFiles({
    name: 'guide-example.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(
    picker.getByRole('button', { name: 'Select', exact: true }),
  ).toBeEnabled()
  await picker.getByRole('button', { name: 'Select', exact: true }).click()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor).toHaveURL(
    /content\/product_guides\/[A-Z0-9]+(?:\?locale=en)?$/,
  )
  const id = new URL(editor.url()).pathname.split('/').at(-1)!
  await editor
    .getByRole('button', { name: 'Add reference', exact: true })
    .click()
  await editor
    .getByRole('dialog')
    .getByText('راهنمای مرتبط منتشرشده', { exact: true })
    .click()
  await editor
    .getByRole('dialog')
    .getByRole('button', { name: 'Add selected', exact: true })
    .click()
  const save = async () => {
    const [response] = await Promise.all([
      editor.waitForResponse(
        (r) =>
          r.request().method() === 'PUT' &&
          new URL(r.url()).pathname.endsWith(`/product_guides/${id}`),
      ),
      editor.getByRole('button', { name: 'Save', exact: true }).click(),
    ])
    expect(response.ok()).toBe(true)
  }
  await save()
  await editor.reload()
  await expect(editor.getByLabel('عنوان', { exact: true })).toHaveValue(
    'افزودن مشتری در سالونا',
  )
  await expect(editor.locator('[contenteditable="true"] ol')).toHaveCount(1)
  await expect(editor.getByLabel('متن همراه ویدئو')).toHaveValue(
    /مستقل از ویدئو/,
  )
  let saved = await cms(editor, `content/product_guides/${id}`)
  expect(saved.item.status).toBe('draft')
  const path = `/guides/${encodeURIComponent(saved.item.slug)}`
  const preview = (
    await cms(editor, `content/product_guides/${id}/preview-url`, {})
  ).url
  const privatePage = await editor.request.get(preview)
  expect(privatePage.status()).toBe(200)
  expect(privatePage.headers()['cache-control']).toContain('private, no-store')
  expect(privatePage.headers()['x-robots-tag']).toContain('noindex')
  expect(await privatePage.text()).toContain('مراحل همین راهنما')
  for (const url of [preview, '/guides/unknown/nested?_preview=invalid']) {
    const response = await page.request.get(url, { maxRedirects: 0 })
    expect(response.status()).toBeGreaterThanOrEqual(400)
    expect(response.headers()['cache-control']).toContain('private, no-store')
    expect(response.headers()['x-robots-tag']).toContain('noindex')
  }
  expect((await page.request.get(path)).status()).toBe(404)
  expect(
    await (await page.request.get('/guides-sitemap.xml')).text(),
  ).not.toContain(path)
  const publish = async (label: string) => {
    await editor
      .getByRole('button', { name: label, exact: true })
      .first()
      .click()
    const [response] = await Promise.all([
      editor.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          new URL(r.url()).pathname.endsWith(`/product_guides/${id}/publish`),
      ),
      editor
        .getByRole('dialog')
        .getByRole('button', { name: label, exact: true })
        .click(),
    ])
    expect(response.ok()).toBe(true)
  }
  await publish('Publish now')
  const slash = await page.request.get(path + '/?from=slash', {
    maxRedirects: 0,
  })
  expect(slash.status()).toBe(301)
  expect(slash.headers().location).toBe(path + '?from=slash')
  await page.goto(path)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('article ol li')).toHaveCount(2)
  await expect(
    page.getByRole('link', { name: 'راهنمای مرتبط منتشرشده', exact: true }),
  ).toBeVisible()
  await expect(page.locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw',
  )
  const image = page.locator('article img').first()
  await expect
    .poll(() =>
      image.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true)
  const html = await page.content()
  expect(html).toContain('"@type":"TechArticle"')
  expect(html.match(/rel="canonical"/g)).toHaveLength(1)
  expect(html).toContain('تیم محصول سالونا')
  expect(await (await page.request.get('/guides')).text()).toContain(
    'افزودن مشتری در سالونا',
  )
  expect(await (await page.request.get('/robots.txt')).text()).toContain(
    '/guides-sitemap.xml',
  )
  expect(
    await (await page.request.get('/guides-sitemap.xml')).text(),
  ).toContain(path)
  await editor
    .getByLabel('عنوان', { exact: true })
    .fill('ثبت دقیق مشتری در سالونا')
  await editor
    .locator('[contenteditable="true"]')
    .first()
    .fill('پس از ذخیره، نام مشتری را در فهرست پیدا کنید.')
  await editor
    .getByLabel('عنوان برای جستجو')
    .fill('عنوان جستجوی پیش‌نویس راهنما')
  await save()
  const live = await (await page.request.get(path)).text()
  expect(live).toContain('افزودن مشتری در سالونا')
  expect(live).not.toContain('ثبت دقیق مشتری در سالونا')
  expect(live).not.toContain('عنوان جستجوی پیش‌نویس راهنما')
  const staged = (
    await cms(editor, `content/product_guides/${id}/preview-url`, {})
  ).url
  expect(await (await editor.request.get(staged)).text()).toContain(
    'ثبت دقیق مشتری در سالونا',
  )
  await publish('Publish changes')
  expect(await (await page.request.get(path)).text()).toContain(
    'ثبت دقیق مشتری در سالونا',
  )
  saved = await cms(editor, `content/product_guides/${id}`)
  const renamed = await cms(
    editor,
    `content/product_guides/${id}`,
    { slug: 'create-client-guide-renamed', data: {}, _rev: saved._rev },
    'PUT',
  )
  expect(
    (await page.request.get('/guides/create-client-guide-renamed')).status(),
  ).toBe(404)
  await cms(editor, `content/product_guides/${id}/publish`, {
    _rev: renamed._rev,
  })
  const redirect = await page.request.get(`${path}?from=old`, {
    maxRedirects: 0,
  })
  expect(redirect.status()).toBe(301)
  expect(redirect.headers().location).toBe(
    '/guides/create-client-guide-renamed?from=old',
  )
  expect(
    await (await page.request.get('/guides-sitemap.xml')).text(),
  ).not.toContain(path)
  const oldPreview = await page.request.get(`${path}?_preview=invalid`, {
    maxRedirects: 0,
  })
  expect(oldPreview.status()).toBe(404)
  expect(oldPreview.headers()['cache-control']).toContain('private, no-store')
  const relatedState = await cms(
    editor,
    `content/product_guides/${related.item.id}`,
  )
  await cms(
    editor,
    `content/product_guides/${related.item.id}`,
    {
      data: { title: 'نام خصوصی راهنمای مرتبط' },
      slug: 'related-private-draft',
      _rev: relatedState._rev,
    },
    'PUT',
  )
  const currentPreview = (
    await cms(editor, `content/product_guides/${id}/preview-url`, {})
  ).url
  for (const response of [
    await page.request.get('/guides/create-client-guide-renamed'),
    await editor.request.get(currentPreview),
  ]) {
    const html = await response.text()
    expect(html).toContain('href="/guides/related-guide"')
    expect(html).toContain('راهنمای مرتبط منتشرشده')
    expect(html).not.toContain('نام خصوصی راهنمای مرتبط')
    expect(html).not.toContain('related-private-draft')
  }
  await checkProductGuide(
    'http://localhost:3303/guides/create-client-guide-renamed',
  )
  await checkGuideDiscovery('http://localhost:3303', {
    present: ['create-client-guide-renamed'],
    robotsOrigin:
      process.env.CMS_E2E_PRODUCTION === '1'
        ? 'http://localhost:3303'
        : 'http://localhost:3001',
  })
  await cms(editor, `content/product_guides/${related.item.id}/unpublish`, {})
  expect(
    await (
      await page.request.get('/guides/create-client-guide-renamed')
    ).text(),
  ).not.toContain('href="/guides/related-guide"')
  await editor.reload()
  const [withdrawn] = await Promise.all([
    editor.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname.endsWith(`/product_guides/${id}/unpublish`),
    ),
    editor
      .getByRole('button', { name: /^Unpublish / })
      .first()
      .click(),
  ])
  expect(withdrawn.ok()).toBe(true)
  for (const url of [
    path,
    path + '/',
    '/guides/create-client-guide-renamed',
    '/guides/create-client-guide-renamed/',
    '/guides/missing',
  ])
    expect((await page.request.get(url, { maxRedirects: 0 })).status()).toBe(
      404,
    )
  expect(await (await page.request.get('/guides')).text()).not.toContain(
    'ثبت دقیق مشتری در سالونا',
  )
  expect(
    await (await page.request.get('/guides-sitemap.xml')).text(),
  ).not.toContain('create-client-guide-renamed')
  await cms(editor, `content/product_guides/${id}`, undefined, 'DELETE')
  expect(
    (await page.request.get('/guides/create-client-guide-renamed')).status(),
  ).toBe(404)
})

test('a current published Blog Article or Product Guide outranks a former slug alias', async ({
  page,
}) => {
  for (const [collection, section] of [
    ['blog_articles', 'blog'],
    ['product_guides', 'guides'],
  ]) {
    const slug = `reused-${section}`
    const old = await cms(editor, `content/${collection}`, {
      slug,
      status: 'draft',
      data: { title: `محتوای نخست ${section}`, summary: 'خلاصه نخست' },
    })
    let saved = await cms(
      editor,
      `content/${collection}/${old.item.id}/publish`,
      {},
    )
    saved = await cms(
      editor,
      `content/${collection}/${old.item.id}`,
      {
        slug: `${slug}-renamed`,
        data: {},
        _rev: saved._rev,
      },
      'PUT',
    )
    await cms(editor, `content/${collection}/${old.item.id}/publish`, {
      _rev: saved._rev,
    })
    const alias = await page.request.get(`/${section}/${slug}`, {
      maxRedirects: 0,
    })
    expect(alias.status()).toBe(301)
    expect(alias.headers().location).toBe(`/${section}/${slug}-renamed`)

    const replacement = await cms(editor, `content/${collection}`, {
      slug,
      status: 'draft',
      data: { title: `محتوای جایگزین ${section}`, summary: 'خلاصه جایگزین' },
    })
    await cms(
      editor,
      `content/${collection}/${replacement.item.id}/publish`,
      {},
    )
    const checkReplacement = async () => {
      const response = await page.request.get(`/${section}/${slug}`, {
        maxRedirects: 0,
      })
      expect.soft(response.status()).toBe(200)
      const html = await response.text()
      expect.soft(html).toContain(`محتوای جایگزین ${section}`)
      expect
        .soft(html)
        .toContain(`href="http://localhost:3303/${section}/${slug}"`)
      expect.soft(html).not.toContain('/_emdash/saluna-public-content/')
      expect
        .soft(response.headers()['cache-control'])
        .toMatch(/private.*no-store/)
    }
    await checkReplacement()
    expect(
      (await page.request.get(`/${section}/${slug}-renamed`)).status(),
    ).toBe(200)
    for (const path of [`/${section}`, `/${section}-sitemap.xml`])
      expect(await (await page.request.get(path)).text()).toContain(
        `/${section}/${slug}`,
      )
    const slash = await page.request.get(`/${section}/${slug}/?from=reuse`, {
      maxRedirects: 0,
    })
    expect.soft(slash.status()).toBe(301)
    expect.soft(slash.headers().location).toBe(`/${section}/${slug}?from=reuse`)
    const preview = (
      await cms(
        editor,
        `content/${collection}/${replacement.item.id}/preview-url`,
        {},
      )
    ).url
    const copied = await page.request.get(preview, { maxRedirects: 0 })
    expect([403, 404]).toContain(copied.status())
    expect(copied.headers()['cache-control']).toMatch(/private.*no-store/)
    expect(copied.headers()['x-robots-tag']).toMatch(/noindex/)
    await cms(editor, `content/${collection}/${old.item.id}/unpublish`, {})
    await checkReplacement()
    await cms(
      editor,
      `content/${collection}/${old.item.id}`,
      undefined,
      'DELETE',
    )
    await checkReplacement()
    expect(
      (
        await page.request.get(
          `/_emdash/saluna-public-content/${section}/${slug}`,
        )
      ).status(),
    ).toBe(404)
    await cms(
      editor,
      `content/${collection}/${replacement.item.id}/unpublish`,
      {},
    )
    for (const path of [`/${section}/${slug}`, `/${section}/${slug}/`])
      expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(
        404,
      )
  }
})

test('a CMS outage returns errors instead of cached redirects or successful published content', async ({
  page,
}) => {
  const created = await cms(author, 'content/blog_articles', {
    slug: 'outage-article',
    status: 'draft',
    data: { title: 'مقاله هنگام قطعی سامانه محتوا' },
  })
  let saved = await cms(
    author,
    `content/blog_articles/${created.item.id}/publish`,
    { _rev: created._rev },
  )
  saved = await cms(
    author,
    `content/blog_articles/${created.item.id}`,
    { slug: 'outage-article-current', data: {}, _rev: saved._rev },
    'PUT',
  )
  await cms(author, `content/blog_articles/${created.item.id}/publish`, {
    _rev: saved._rev,
  })
  expect(
    (
      await page.request.get('/blog/outage-article', { maxRedirects: 0 })
    ).status(),
  ).toBe(301)
  expect(
    (await page.request.get('/blog/outage-article-current')).status(),
  ).toBe(200)
  expect((await page.request.get('/blog')).status()).toBe(200)
  await checkCmsHealth('http://localhost:3303')
  // Fault the disposable external service, not CMS tables or query helpers.
  // This is the final test; fixture cleanup tolerates the removed container.
  const containers = spawnSync(
    'docker',
    [
      'ps',
      '--filter',
      'label=saluna.cms-e2e-port=3303',
      '--format',
      '{{.Names}}',
    ],
    { encoding: 'utf8' },
  )
  expect(containers.status).toBe(0)
  const names = containers.stdout.trim().split('\n')
  expect(names).toHaveLength(1)
  expect(names[0]).toMatch(/^saluna-cms-e2e-\d+$/)
  expect(
    spawnSync('docker', ['stop', '--time', '1', names[0]], { stdio: 'ignore' })
      .status,
  ).toBe(0)
  expect((await page.request.get('/')).status()).toBe(200)
  await expect(checkCmsHealth('http://localhost:3303')).rejects.toThrow()
  for (const path of [
    '/blog/outage-article',
    '/blog/outage-article-current',
    '/blog',
    '/blog-sitemap.xml',
    '/guides',
    '/guides/missing',
    '/guides-sitemap.xml',
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(500)
    expect(response.headers()['cache-control']).toContain('private, no-store')
    expect(response.headers().location).toBeUndefined()
  }
})
