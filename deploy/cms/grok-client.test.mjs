import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { readPrivateJson } from '../../scripts/cms-draft-client.mjs'

const config = process.env.CMS_GROK_CONFIG
assert(config, 'Set CMS_GROK_CONFIG to the protected local connection file')

test('Studio can inspect current native drafts and published overlap without receiving credentials', async () => {
  const child = spawn(
    process.execPath,
    ['scripts/grok-draft-cli.mjs', config, 'inventory'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const chunks = []
  child.stdout.on('data', (chunk) => chunks.push(chunk))
  child.stderr.on('data', (chunk) => chunks.push(chunk))
  const code = await new Promise((resolve) => child.once('exit', resolve))
  const output = Buffer.concat(chunks).toString()
  assert.equal(code, 0, output)
  const result = JSON.parse(output)
  assert(result.tools.includes('content_create'))
  assert(result.tools.includes('content_update'))
  assert(result.tools.includes('media_upload'))
  assert(
    result.items.some(
      (item) =>
        item.slug === 'salon-staff-commission-calculation' &&
        item.status === 'draft',
    ),
  )
  assert(
    result.items.some(
      (item) =>
        item.slug === 'recovery-published-article' &&
        item.status === 'published',
    ),
  )
  const settings = await readPrivateJson(config)
  const credentials = await readPrivateJson(settings.credentials)
  assert(!output.includes(credentials.access_token))
  assert(!output.includes(credentials.refresh_token))
  assert(!output.includes('_preview='))
})

test('Studio article input cannot read outside its exchange directory', async () => {
  const child = spawn(
    process.execPath,
    ['scripts/grok-draft-cli.mjs', config, 'create', '../agent-oauth.json'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const chunks = []
  child.stdout.on('data', (chunk) => chunks.push(chunk))
  child.stderr.on('data', (chunk) => chunks.push(chunk))
  const code = await new Promise((resolve) => child.once('exit', resolve))
  assert.equal(code, 1)
  assert.equal(
    Buffer.concat(chunks).toString().trim(),
    'CMS EXCHANGE_FILE_REQUIRED',
  )
})
