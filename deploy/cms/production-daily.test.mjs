import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  DRAFT_SCOPES,
  readPrivateJson,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'
import {
  initializeDailyJournal,
  deliverDailyDraft,
  dailyDraftStatus,
} from '../../scripts/daily-draft-delivery.mjs'

async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'saluna-production-daily-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const credentials = resolve(directory, 'credentials.json')
  await writePrivateJson(credentials, {
    baseURL: 'https://saluna.ir',
    locale: 'en',
    role: 30,
    scope: DRAFT_SCOPES.join(' '),
    userId: 'production-author',
    tokenType: 'pat',
    access_token: 'test-token',
    expiresAt: Date.now() + 3_600_000,
  })
  const config = {
    target: 'production',
    credentials,
    repository: process.cwd(),
    journal: resolve(directory, 'journal'),
    scheduledTime: '12:00',
  }
  await initializeDailyJournal(config)
  const input = {
    subject: 'client-records',
    slug: 'ثبت-منبع-آشنایی-مشتری',
    data: {
      title: 'منبع آشنایی مشتری',
      summary: 'خلاصه',
      seo_title: 'جستجو',
      seo_description: 'توضیح',
      body: [{ _type: 'block', children: [{ _type: 'span', text: 'متن' }] }],
      search_excluded: false,
    },
  }
  const state = {
    creates: 0,
    updates: 0,
    readFailure: false,
    visible: false,
    entries: [],
    saved: undefined,
  }
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    url = new URL(url)
    assert.equal(url.origin, 'https://saluna.ir')
    if (url.pathname.endsWith('/preview-url'))
      return Response.json({
        success: true,
        data: {
          url: 'https://saluna.ir/blog/preview/fixture?token=test',
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        },
      })
    if (url.pathname === '/blog/preview/fixture')
      return new Response('', { status: 403 })
    if (url.pathname === '/blog/' || url.pathname === '/blog-sitemap.xml')
      return new Response('public articles')
    if (url.pathname.startsWith('/blog/'))
      return new Response('', { status: state.visible ? 200 : 404 })
    assert.equal(url.pathname, '/_emdash/api/mcp')
    const request = JSON.parse(options.body)
    let result
    if (request.method === 'initialize') result = {}
    else if (request.method === 'tools/list') result = { tools: [] }
    else {
      const { name, arguments: args } = request.params
      assert(
        [
          'content_list',
          'content_get',
          'content_create',
          'content_update',
        ].includes(name),
      )
      let value
      if (name === 'content_list') value = { items: state.entries }
      if (name === 'content_create') {
        state.creates++
        assert.equal(args.status, 'draft')
        assert.equal(args.slug, input.slug)
        state.saved = {
          _rev: 'revision-1',
          item: {
            id: 'saved-production-id',
            version: 1,
            authorId: 'production-author',
            locale: 'en',
            slug: args.slug,
            status: 'draft',
            data: args.data,
          },
        }
        state.entries.push(state.saved.item)
        value = state.saved
      }
      if (name === 'content_get') {
        if (state.readFailure)
          throw new TypeError('simulated read transport failure')
        value = state.saved
      }
      if (name === 'content_update') {
        state.updates++
        throw new Error('Unexpected update')
      }
      result = { content: [{ type: 'text', text: JSON.stringify(value) }] }
    }
    return Response.json({ jsonrpc: '2.0', id: request.id, result })
  })
  return { config, input, state }
}

test('production daily delivery uses Persian slugs, verifies privacy without a local passkey, and retries the same ID', async (t) => {
  const { config, input, state } = await fixture(t)
  const result = await deliverDailyDraft(config, '2100-01-01', input)
  assert.equal(result.status, 'verified')
  assert.equal(result.creation, 'saved')
  assert.equal(result.id, 'saved-production-id')
  assert.deepEqual(result.verification, {
    savedDraft: true,
    anonymousPrivacy: true,
    authenticatedPreview: false,
  })
  const retry = await deliverDailyDraft(config, '2100-01-01')
  assert.equal(retry.id, result.id)
  assert.equal(retry.eventId, result.eventId)
  assert.equal(state.creates, 1)
})

test('production saves the create receipt before a failed read and retains it through verification failures', async (t) => {
  const { config, input, state } = await fixture(t)
  state.readFailure = true
  const failedRead = await deliverDailyDraft(config, '2100-01-01', input)
  assert.equal(failedRead.status, 'saved_needs_read')
  assert.equal(failedRead.id, 'saved-production-id')
  state.readFailure = false
  state.visible = true
  const failedPreview = await deliverDailyDraft(config, '2100-01-01')
  assert.equal(failedPreview.status, 'saved_needs_preview')
  assert.equal(failedPreview.code, 'DRAFT_PUBLICLY_VISIBLE')
  state.visible = false
  const retry = await deliverDailyDraft(config, '2100-01-01')
  assert.equal(retry.status, 'verified')
  assert.equal(state.creates, 1)
})

test('production rejects slug collisions and changed editors without creating a replacement or overwriting content', async (t) => {
  const { config, input, state } = await fixture(t)
  state.entries = [
    { slug: input.slug, id: 'existing-id', data: { title: 'existing' } },
  ]
  const collision = await deliverDailyDraft(config, '2100-01-01', input)
  assert.equal(collision.code, 'DRAFT_SLUG_COLLISION')
  assert.equal(state.creates, 0)
  state.entries = []
  await deliverDailyDraft(config, '2100-01-01')
  state.saved = { ...state.saved, _rev: 'editor-revision' }
  const handoff = await deliverDailyDraft(config, '2100-01-01')
  assert.equal(handoff.status, 'handed_off')
  assert.equal(state.creates, 1)
  assert.equal(state.updates, 0)
})

test('production rejects a local origin and an English slug before registering a date', async (t) => {
  const { config, input } = await fixture(t)
  await assert.rejects(
    deliverDailyDraft(config, '2100-01-01', { ...input, slug: 'english-slug' }),
    /PERSIAN_SLUG_REQUIRED/,
  )
  assert.equal((await dailyDraftStatus(config, '2100-01-01')).status, 'new')
  const credentials = await readPrivateJson(config.credentials)
  await writePrivateJson(config.credentials, {
    ...credentials,
    baseURL: 'http://localhost:3301',
  })
  await assert.rejects(
    deliverDailyDraft(config, '2100-01-01', input),
    /DAILY_ENDPOINT_CHANGED/,
  )
  assert.equal((await dailyDraftStatus(config, '2100-01-01')).status, 'new')
})
