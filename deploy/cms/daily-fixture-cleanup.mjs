#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  cmsDraftClient,
  readPrivateJson,
} from '../../scripts/cms-draft-client.mjs'
import { technicalSession } from './technical-session.mjs'

// Operator-only teardown of this named, disposable daily fault-test workflow.
// Neither Studio nor the daily runner can call this through their wrapper.
const directory = process.argv[2]
assert(directory && resolve(directory) === directory)
const credentials = await readPrivateJson(
  resolve(directory, 'agent-oauth.json'),
)
assert.equal(credentials.baseURL, 'http://localhost:3301')
const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
const owned = (item) =>
  /^(daily-fixture-|daily-receipt-)/.test(item.slug) &&
  item.authorId === credentials.userId
const active = (await client.listArticles()).filter(owned)
const editor = await technicalSession(
  resolve(directory, 'browser-state.json'),
  'editor',
)
const author = await technicalSession(
  resolve(directory, 'agent-browser-state.json'),
  'author',
)
let operator
let sessionsClosed = false
const media = new Set()
let removed = 0,
  mediaRemoved = 0
async function collect(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const target = resolve(path, item.name)
    if (item.isDirectory()) await collect(target)
    else if (item.isFile() && /^2100-\d\d-\d\d\.json$/.test(item.name)) {
      try {
        const record = JSON.parse(await readFile(target, 'utf8'))
        if (record.media?.id) media.add(record.media.id)
      } catch {
        /* Intentionally corrupt journal fixtures have no usable receipt. */
      }
    }
  }
}
try {
  for (const item of await readdir(directory, { withFileTypes: true }))
    if (item.isDirectory() && item.name.startsWith('daily-test-'))
      await collect(resolve(directory, item.name))
  for (const item of active) {
    for (const session of [editor, author])
      await session.api(
        `content/blog_articles/${item.id}/lock`,
        undefined,
        'DELETE',
      )
  }
  await editor.close()
  await author.close()
  sessionsClosed = true
  operator = await technicalSession(
    resolve(directory, 'browser-state.json'),
    'operator',
  )
  for (const item of active)
    await operator.api(`content/blog_articles/${item.id}`, undefined, 'DELETE')
  const trash = [],
    seen = new Set()
  let cursor
  do {
    const page = await operator.api(
      `content/blog_articles/trash?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    )
    trash.push(...page.items.filter(owned))
    cursor = page.nextCursor
    assert(!cursor || !seen.has(cursor))
    seen.add(cursor)
  } while (cursor)
  for (const item of trash) {
    await operator.api(
      `content/blog_articles/${item.id}/permanent`,
      undefined,
      'DELETE',
    )
    removed++
  }
  for (const id of media) {
    const response = await operator.page.request.get(
      `http://localhost:3301/_emdash/api/media/${id}`,
    )
    if (response.status() === 404) continue
    assert.equal(response.status(), 200)
    const json = await response.json()
    assert(json.success)
    const saved = json.data
    assert.equal(saved.item.authorId, credentials.userId)
    assert(
      [
        [48, 32],
        [49, 33],
      ].some(
        ([width, height]) =>
          saved.item.width === width && saved.item.height === height,
      ),
    )
    await operator.api(`media/${id}`, undefined, 'DELETE')
    mediaRemoved++
  }
  assert.equal((await client.listArticles()).filter(owned).length, 0)
  console.log(
    JSON.stringify({
      articlesRemoved: removed,
      mediaRemoved,
      origin: credentials.baseURL,
      fixturePrefixes: ['daily-fixture-', 'daily-receipt-'],
    }),
  )
} finally {
  if (operator) await operator.close()
  else if (!sessionsClosed) {
    await editor.close()
    await author.close()
  }
}
