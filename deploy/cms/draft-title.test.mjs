import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  cmsDraftClient,
  DRAFT_SCOPES,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'
import {
  dailyDraftStatus,
  deliverDailyDraft,
  initializeDailyJournal,
} from '../../scripts/daily-draft-delivery.mjs'

async function fixture(t, title = 'عنوان کوتاه') {
  const directory = await mkdtemp(resolve(tmpdir(), 'saluna-title-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const credentials = resolve(directory, 'credentials.json')
  await writePrivateJson(credentials, {
    baseURL: 'http://localhost:3301',
    locale: 'en',
    role: 30,
    scope: DRAFT_SCOPES.join(' '),
    userId: 'test-author',
    access_token: 'local-test-token',
    expiresAt: Date.now() + 3_600_000,
  })
  let saved = {
    _rev: '1',
    item: {
      id: 'test-draft',
      authorId: 'test-author',
      status: 'draft',
      locale: 'en',
      data: { title },
    },
  }
  const calls = []
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body)
    calls.push(request)
    const { name, arguments: args } = request.params
    if (name === 'content_create' || name === 'content_update')
      saved = {
        _rev: String(Number(saved._rev) + 1),
        item: { ...saved.item, data: { ...saved.item.data, ...args.data } },
      }
    assert(['content_create', 'content_update', 'content_get'].includes(name))
    return Response.json({
      jsonrpc: '2.0',
      id: request.id,
      result: { content: [{ type: 'text', text: JSON.stringify(saved) }] },
    })
  })
  return {
    client: await cmsDraftClient(credentials),
    current: () => saved,
    calls,
    directory,
    credentials,
  }
}

test('overlong Persian and Latin titles are rejected before a draft can be saved', async (t) => {
  const { client, calls } = await fixture(t)
  let receiptSaved = false
  for (const title of ['س'.repeat(51), 'a'.repeat(51)])
    await assert.rejects(
      client.createDraft({ slug: 'example', data: { title } }, async () => {
        receiptSaved = true
      }),
      /CMS DRAFT_TITLE_TOO_LONG/,
    )
  assert.equal(receiptSaved, false)
  assert.equal(calls.length, 0)
})

test('the boundary counts Unicode characters and leaves the SEO title separate', async (t) => {
  const { client } = await fixture(t)
  const title = 'آ'.repeat(49) + '💈'
  const seo_title = 'توضیح برای جست‌وجو '.repeat(10)
  const saved = await client.createDraft({
    slug: 'example',
    data: { title, seo_title },
  })
  assert.equal(saved.item.data.title, title)
  assert.equal(saved.item.data.seo_title, seo_title)
  await assert.rejects(
    client.createDraft({ slug: 'another', data: { title: title + 'س' } }),
    /CMS DRAFT_TITLE_TOO_LONG/,
  )
})

test('equivalent composed characters and surrounding whitespace use the same title budget', async (t) => {
  const { client } = await fixture(t)
  const title = `  ${'e\u0301'.repeat(50)}  `
  const saved = await client.createDraft({ slug: 'example', data: { title } })
  assert.equal(saved.item.data.title, title)
})

test('blank, non-text and overlong title revisions cannot replace a saved title', async (t) => {
  const { client, current, calls } = await fixture(t)
  for (const title of ['', '  ', null, 123])
    await assert.rejects(
      client.reviseDraft(current(), { title }),
      /CMS DRAFT_TITLE_REQUIRED/,
    )
  await assert.rejects(
    client.reviseDraft(current(), { title: 'س'.repeat(51) }),
    /CMS DRAFT_TITLE_TOO_LONG/,
  )
  assert.equal(current().item.data.title, 'عنوان کوتاه')
  assert.equal(calls.length, 0)
})

test('legacy long titles allow other edits and can be shortened on the same draft', async (t) => {
  const { client, current } = await fixture(t, 'س'.repeat(68))
  const updated = await client.reviseDraft(current(), { summary: 'خلاصه تازه' })
  assert.equal(updated.item.data.title, 'س'.repeat(68))
  assert.equal(updated.item.data.summary, 'خلاصه تازه')
  const shortened = await client.reviseDraft(updated, {
    title: 'محاسبه کمیسیون پرسنل سالن',
  })
  assert.equal(shortened.item.id, updated.item.id)
  assert.equal(shortened.item.data.title, 'محاسبه کمیسیون پرسنل سالن')
})

test('daily delivery rejects an overlong title before registering or freezing its date', async (t) => {
  const { directory, credentials, calls } = await fixture(t)
  const config = {
    credentials,
    journal: resolve(directory, 'journal'),
    repository: process.cwd(),
  }
  await initializeDailyJournal(config)
  await assert.rejects(
    deliverDailyDraft(config, '2100-01-01', {
      subject: 'staff-commission',
      data: {
        title: 'س'.repeat(51),
        summary: 'خلاصه',
        seo_title: 'عنوان جست‌وجو',
        seo_description: 'توضیح جست‌وجو',
        search_excluded: false,
        body: [{ _type: 'block', children: [] }],
      },
    }),
    /CMS DRAFT_TITLE_TOO_LONG/,
  )
  const status = await dailyDraftStatus(config, '2100-01-01')
  assert.equal(status.status, 'new')
  assert.equal(status.requiresInput, true)
  assert.equal(calls.length, 0)
})
