import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'

const directory = process.env.CMS_AGENT_TEST_PRIVATE_DIR
assert(
  directory && resolve(directory) === directory,
  'Set CMS_AGENT_TEST_PRIVATE_DIR to protected local fixture state',
)
const tokenPath = resolve(directory, 'agent-oauth.json')
const state = await readPrivateJson(
  resolve(directory, 'agent-browser-state.json'),
)

test('expired stored OAuth access is refreshed natively and the old access token is revoked', async () => {
  const before = await readPrivateJson(tokenPath)
  await writePrivateJson(tokenPath, { ...before, expiresAt: Date.now() - 1 })
  // Separate commands start with the same expired grant. Only the lock holder
  // refreshes it; the other reloads the already rotated credentials.
  await Promise.all(
    [1, 2].map(
      () =>
        new Promise((done, reject) => {
          const child = spawn(
            process.execPath,
            [
              '--input-type=module',
              '-e',
              `
      import{cmsDraftClient}from'./scripts/cms-draft-client.mjs';
      const c=await cmsDraftClient(process.argv[1]);await c.connect();await c.listArticles();
    `,
              tokenPath,
            ],
            { stdio: 'ignore' },
          )
          child.once('error', reject)
          child.once('exit', (code) =>
            code === 0
              ? done()
              : reject(new Error('Concurrent native refresh failed')),
          )
        }),
    ),
  )
  const client = await cmsDraftClient(tokenPath)
  const after = await readPrivateJson(tokenPath)
  assert.notEqual(after.access_token, before.access_token)
  assert(after.expiresAt > Date.now())
  assert.equal(
    (
      await fetch(`${before.baseURL}/_emdash/api/mcp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${before.access_token}`,
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      })
    ).status,
    401,
  )
  assert.equal((await client.getArticle(state.draftId)).item.status, 'draft')
})

test('native stale revisions cannot overwrite a newer saved draft', async () => {
  const client = await cmsDraftClient(tokenPath)
  const current = await client.getArticle(state.draftId)
  try {
    await client.reviseDraft(current, {
      seo_description: `آزمون نسخه ذخیره‌شده ${Date.now()}`,
    })
    await assert.rejects(
      client.reviseDraft(current, { title: 'نباید جایگزین شود' }),
      /CMS CONFLICT/,
    )
    assert.equal(
      (await client.getArticle(state.draftId)).item.data.title,
      'پیش‌نویس فارسی از اتصال نویسنده',
    )
  } finally {
    await client.reviseDraft(await client.getArticle(state.draftId), {
      seo_description: current.item.data.seo_description,
    })
  }
})

test('draft operations cannot accidentally withdraw the existing published article', async () => {
  const client = await cmsDraftClient(tokenPath)
  const current = await client.getArticle('recovery-published-article')
  assert.equal(current.item.status, 'published')
  await assert.rejects(
    async () => client.reviseDraft(current, { title: 'نباید جایگزین شود' }),
    /CMS NOT_PLAIN_DRAFT/,
  )
  assert.equal(
    (await fetch('http://localhost:3301/blog/recovery-published-article'))
      .status,
    200,
  )
})

test('the local CLI returns a saved draft and private preview to protected files', async () => {
  const cli = resolve('scripts/cms-draft-cli.mjs')
  const requestPath = resolve(directory, 'cli-read-request.json')
  const outputPath = resolve(directory, 'cli-read-result.json')
  await writePrivateJson(requestPath, { id: state.draftId })
  const run = async (action, output) => {
    const child = spawn(
      process.execPath,
      [cli, action, tokenPath, requestPath, output],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const chunks = []
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => chunks.push(chunk))
    const code = await new Promise((resolve) => child.once('exit', resolve))
    assert.equal(code, 0, `${action} CLI must succeed`)
    const text = Buffer.concat(chunks).toString()
    const credentials = await readPrivateJson(tokenPath)
    assert(
      !text.includes(credentials.access_token) &&
        !text.includes(credentials.refresh_token) &&
        !text.includes('_preview='),
      'CLI must keep credentials and private links out of logs',
    )
  }
  await run('read', outputPath)
  assert.equal((await readPrivateJson(outputPath)).item.id, state.draftId)
  const previewPath = resolve(directory, 'cli-preview-result.json')
  await run('preview', previewPath)
  const preview = await readPrivateJson(previewPath)
  assert(
    new URL(preview.url, 'http://localhost:3301').searchParams.has('_preview'),
  )
  assert.equal(
    (await fetch(new URL(preview.url, 'http://localhost:3301'))).status,
    403,
  )
})

test('CLI results cannot overwrite its credential input', async () => {
  const copy = resolve(directory, 'cli-credential-copy.json')
  await writePrivateJson(copy, await readPrivateJson(tokenPath))
  const request = resolve(directory, 'cli-read-request.json')
  await writePrivateJson(request, { id: state.draftId })
  try {
    const child = spawn(
      process.execPath,
      [resolve('scripts/cms-draft-cli.mjs'), 'read', copy, request, copy],
      { stdio: 'ignore' },
    )
    const code = await new Promise((resolve) => child.once('exit', resolve))
    assert.equal(code, 1)
    assert((await readPrivateJson(copy)).access_token)
  } finally {
    await unlink(copy)
  }
})
