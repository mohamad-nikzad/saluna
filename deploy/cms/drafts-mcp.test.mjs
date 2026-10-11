import { test } from 'node:test'
import assert from 'node:assert/strict'
import { draftMcpOperations } from '../../scripts/cms-drafts-mcp.mjs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  cmsDraftClient,
  DRAFT_SCOPES,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'

function fixture(item = {}, rev = 'fresh') {
  const writes = []
  const client = {
    async getArticle() {
      return {
        _rev: rev,
        item: {
          id: 'draft-id',
          status: 'draft',
          liveRevisionId: null,
          scheduledAt: null,
          ...item,
        },
      }
    },
    async createDraft(args) {
      writes.push(args)
      return { item: { status: 'draft' } }
    },
    async reviseDraft(current, data) {
      writes.push({ current, data })
      return current
    },
  }
  return {
    writes,
    operations: draftMcpOperations({
      blog_articles: client,
      product_guides: client,
    }),
  }
}

test('MCP exposes no publication, scheduling, deletion or administration operation', async () => {
  const { operations, writes } = fixture()
  assert.deepEqual(
    operations.tools.map((tool) => tool.name),
    [
      'drafts_list',
      'draft_get',
      'draft_create',
      'draft_revise',
      'media_get',
      'media_upload',
      'draft_preview',
    ],
  )
  for (const name of [
    'content_publish',
    'content_schedule',
    'content_delete',
    'settings_update',
  ])
    await assert.rejects(operations.call(name, {}), /DRAFT_TOOL_NOT_ALLOWED/)
  assert.equal(writes.length, 0)
})

test('create accepts Persian guide slugs and refuses live-status injection or English slugs', async () => {
  const { operations, writes } = fixture()
  const args = {
    collection: 'product_guides',
    slug: 'افزودن-مشتری-در-سالونا',
    data: { title: 'افزودن مشتری' },
  }
  await operations.call('draft_create', args)
  await assert.rejects(
    operations.call('draft_create', { ...args, status: 'published' }),
    /INVALID_TOOL_ARGUMENTS/,
  )
  await assert.rejects(
    operations.call('draft_create', { ...args, scheduledAt: '2030-01-01' }),
    /INVALID_TOOL_ARGUMENTS/,
  )
  await assert.rejects(
    operations.call('draft_create', { ...args, slug: 'new-guide' }),
    /PERSIAN_SLUG_REQUIRED/,
  )
  assert.equal(writes.length, 1)
})

test('revisions refuse published, formerly published and scheduled entries before writing', async () => {
  for (const item of [
    { status: 'published' },
    { liveRevisionId: 'live' },
    { scheduledAt: '2030-01-01' },
  ]) {
    const { operations, writes } = fixture(item)
    await assert.rejects(
      operations.call('draft_revise', {
        collection: 'blog_articles',
        id: 'draft-id',
        _rev: 'fresh',
        data: { title: 'تغییر' },
      }),
      /NOT_PLAIN_DRAFT/,
    )
    assert.equal(writes.length, 0)
  }
})

test('revisions require the current native token and preserve the selected collection', async () => {
  const { operations, writes } = fixture()
  const args = {
    collection: 'product_guides',
    id: 'draft-id',
    _rev: 'stale',
    data: { title: 'تغییر' },
  }
  await assert.rejects(
    operations.call('draft_revise', args),
    /REVISION_CHANGED/,
  )
  await operations.call('draft_revise', { ...args, _rev: 'fresh' })
  assert.equal(writes.length, 1)
})

test('an expired production PAT fails without trying OAuth refresh or sending a request', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'saluna-mcp-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'credentials.json')
  await writePrivateJson(path, {
    baseURL: 'https://saluna.ir',
    locale: 'en',
    role: 30,
    scope: DRAFT_SCOPES.join(' '),
    userId: 'test-author',
    tokenType: 'pat',
    access_token: 'test-token',
    expiresAt: Date.now() - 1,
  })
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('No network request expected')
  })
  const client = await cmsDraftClient(path)
  await assert.rejects(client.connect(), /CMS TOKEN_EXPIRED/)
  assert.equal(fetch.mock.callCount(), 0)
})

test('the native client rejects a different author before revision or signed preview creation', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'saluna-mcp-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'credentials.json')
  await writePrivateJson(path, {
    baseURL: 'https://saluna.ir',
    locale: 'en',
    role: 30,
    scope: DRAFT_SCOPES.join(' '),
    userId: 'test-author',
    tokenType: 'pat',
    access_token: 'test-token',
    expiresAt: Date.now() + 3_600_000,
  })
  const current = {
    _rev: 'fresh',
    item: {
      id: 'foreign-draft',
      status: 'draft',
      authorId: 'other-author',
      locale: 'en',
    },
  }
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body)
    assert.equal(request.params.name, 'content_get')
    return Response.json({
      jsonrpc: '2.0',
      id: request.id,
      result: { content: [{ type: 'text', text: JSON.stringify(current) }] },
    })
  })
  const client = await cmsDraftClient(path)
  await assert.rejects(
    client.reviseDraft(current, { title: 'تغییر' }),
    /CMS NOT_OWN_DRAFT/,
  )
  await assert.rejects(client.preview(current.item.id), /CMS NOT_OWN_DRAFT/)
  assert.equal(fetch.mock.callCount(), 1)
})
