import { expect, test, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
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
  expect((await page.request.get('/blog/default-credit')).status()).toBe(404)
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
  const credits = (await cms(editor, 'admin/bylines')).items
  const leila = credits.find(
    (byline: { slug: string }) => byline.slug === 'leila',
  )
  const saved = await cms(editor, `content/blog_articles/${imageArticle.id}`)
  await cms(
    editor,
    `content/blog_articles/${imageArticle.id}`,
    { bylines: [{ bylineId: leila.id }], _rev: saved._rev },
    'PUT',
  )
  const credited = await cms(editor, `content/blog_articles/${imageArticle.id}`)
  await cms(editor, `content/blog_articles/${imageArticle.id}/publish`, {
    _rev: credited._rev,
  })
  await page.goto(`/blog/${encodeURIComponent(credited.item.slug)}`)
  await expect(page.locator('article')).toContainText('لیلا رضایی')
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
    await expect(
      contributor.getByText('پیش‌نمایش پیش‌نویس', { exact: true }),
    ).toBeVisible()
    expect(preview!.headers()['cache-control']).toContain('private, no-store')
    expect(preview!.headers()['x-robots-tag']).toContain('noindex')
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
  await openAdmin(author)
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
  await cms(editor, `content/blog_articles/${id}`, undefined, 'DELETE')
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
  for (const path of [
    '/blog/outage-article',
    '/blog/outage-article-current',
    '/blog',
  ]) {
    const response = await page.request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(500)
    expect(response.headers()['cache-control']).toContain('private, no-store')
    expect(response.headers().location).toBeUndefined()
  }
})
