import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, chmod, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { promisify } from 'node:util'
import { nativeFaultProxy } from './daily-fault-proxy.mjs'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'
import { technicalSession } from './technical-session.mjs'
import sharp from 'sharp'

const execute = promisify(execFile)
const directory = process.env.CMS_DAILY_TEST_PRIVATE_DIR
assert(directory && resolve(directory) === directory)
const root = await mkdtemp(resolve(directory, 'daily-test-'))
await chmod(root, 0o700)
test.after(async () => {
  const result = await execute(process.execPath, [
    'deploy/cms/daily-fixture-cleanup.mjs',
    directory,
  ])
  console.log(`Daily fixture cleanup ${result.stdout.trim()}`)
})
const payload = {
  subject: 'staff-scheduling',
  data: {
    title: 'برنامه کاری آزمایشی',
    summary: 'نمونه فارسی برای اثبات ذخیره روزانه',
    seo_title: 'برنامه کاری آزمایشی',
    seo_description: 'توضیح برای آزمون ذخیره روزانه',
    search_excluded: false,
    body: [
      {
        _type: 'block',
        _key: 'intro',
        style: 'normal',
        markDefs: [],
        children: [
          {
            _type: 'span',
            _key: 'text',
            marks: [],
            text: 'این نوشته یک آزمون جداگانه است.',
          },
        ],
      },
    ],
  },
}
async function dailyFixture(proxy) {
  const dir = await mkdtemp(resolve(root, 'case-'))
  const config = resolve(dir, 'config.json')
  const journal = resolve(dir, 'journal')
  const prefix = `daily-fixture-${Date.now()}-${dir.split('-').at(-1).toLowerCase()}`
  await writePrivateJson(config, {
    credentials: resolve(directory, 'agent-oauth.json'),
    journal,
    slugPrefix: prefix,
    repository: process.cwd(),
    sessionState: resolve(directory, 'agent-browser-state.json'),
  })
  const request = resolve(dir, 'article.json')
  await writePrivateJson(request, payload)
  const run = async (action, ...args) => {
    const childArgs = [
      ...(proxy ? ['--import', './deploy/cms/daily-fault-fetch.mjs'] : []),
      'scripts/daily-draft-cli.mjs',
      config,
      action,
      ...args,
    ]
    const result = await execute(process.execPath, childArgs, {
      env: {
        ...process.env,
        ...(proxy ? { CMS_TEST_PROXY_URL: proxy.origin } : {}),
      },
    }).catch((error) => ({ stdout: error.stdout, code: error.code }))
    assert(!result.stdout.includes('_preview='))
    return JSON.parse(result.stdout)
  }
  await run('init')
  return { run, request, journal, config, prefix }
}

test('a confirmed native create ID is saved before its verification read can fail', async () => {
  const proxy = await nativeFaultProxy()
  proxy.fault('read-after-create')
  const receipt = resolve(root, 'receipt.json')
  const slug = `daily-receipt-${Date.now()}`
  try {
    await execute(
      process.execPath,
      [
        '--import',
        './deploy/cms/daily-fault-fetch.mjs',
        '--input-type=module',
        '-e',
        `
      import {cmsDraftClient,writePrivateJson} from './scripts/cms-draft-client.mjs';
      const client=await cmsDraftClient(process.argv[1]);
      try {await client.createDraft({slug:process.argv[3],data:{title:'آزمون رسید ذخیره‌شده'}},
        async result=>writePrivateJson(process.argv[2],{id:result.item.id}));}
      catch(error){if(error.message!=='CMS MCP_HTTP_503') throw error;}
    `,
        resolve(directory, 'agent-oauth.json'),
        receipt,
        slug,
      ],
      {
        env: { ...process.env, CMS_TEST_PROXY_URL: proxy.origin },
      },
    )
    const saved = await readPrivateJson(receipt)
    const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
    assert.equal((await client.getArticle(saved.id)).item.slug, slug)
  } finally {
    await proxy.close()
  }
})

test('repeated and overlapping daily attempts retain one native draft and a separate reporting acknowledgement', async () => {
  const config = resolve(root, 'daily-config.json')
  await writePrivateJson(config, {
    credentials: resolve(directory, 'agent-oauth.json'),
    journal: resolve(root, 'journal'),
    slugPrefix: `daily-fixture-${Date.now()}`,
    repository: process.cwd(),
    sessionState: resolve(directory, 'agent-browser-state.json'),
  })
  const request = resolve(root, 'article.json')
  await writePrivateJson(request, {
    subject: 'staff-scheduling',
    data: {
      title: 'برنامه کاری آزمایشی',
      summary: 'نمونه فارسی برای اثبات ذخیره روزانه',
      seo_title: 'برنامه کاری آزمایشی',
      seo_description: 'توضیح برای آزمون ذخیره روزانه',
      search_excluded: false,
      body: [
        {
          _type: 'block',
          _key: 'intro',
          style: 'normal',
          markDefs: [],
          children: [
            {
              _type: 'span',
              _key: 'text',
              marks: [],
              text: 'این نوشته یک آزمون جداگانه است.',
            },
          ],
        },
      ],
    },
  })
  const run = async (action, ...args) => {
    const result = await execute(process.execPath, [
      'scripts/daily-draft-cli.mjs',
      config,
      action,
      ...args,
    ])
    assert(!result.stdout.includes('_preview='))
    return JSON.parse(result.stdout)
  }
  await run('init')
  const attempts = await Promise.all([
    run('run', '2100-01-01', request),
    run('run', '2100-01-01', request),
  ])
  assert.equal(attempts[0].id, attempts[1].id)
  assert.equal(attempts[0].status, 'verified')
  assert.equal(attempts[0].reported, false)
  const again = await run('run', '2100-01-01')
  assert.equal(again.id, attempts[0].id)
  const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
  const current = await client.getArticle(again.id)
  assert.equal(current.item.status, 'draft')
  assert(!current.item.liveRevisionId && !current.item.scheduledAt)
  assert.equal(
    (await client.listArticles()).filter(
      (item) => item.slug === current.item.slug,
    ).length,
    1,
  )
})

test('a real saved create with a lost response is adopted once by frozen payload and original slug', async () => {
  const proxy = await nativeFaultProxy()
  try {
    const fixture = await dailyFixture(proxy)
    proxy.fault('lose-create')
    const failed = await fixture.run('run', '2100-02-01', fixture.request)
    assert.equal(failed.status, 'create_unknown')
    assert.equal(failed.creation, 'unknown')
    assert(!failed.id && !failed.reported)
    const recovered = await fixture.run('run', '2100-02-01')
    assert.equal(recovered.status, 'verified')
    assert(recovered.id)
    const again = await fixture.run('run', '2100-02-01')
    assert.equal(again.id, recovered.id)
    const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
    assert.equal(
      (await client.listArticles()).filter(
        (item) => item.slug === `${fixture.prefix}-2100-02-01`,
      ).length,
      1,
    )
  } finally {
    await proxy.close()
  }
})

test('lost create followed by editor rename or deletion stays ambiguous and never creates a replacement', async () => {
  const editor = await technicalSession(
    resolve(directory, 'browser-state.json'),
    'editor',
  )
  try {
    for (const action of ['rename', 'delete']) {
      const proxy = await nativeFaultProxy()
      try {
        const fixture = await dailyFixture(proxy)
        proxy.fault('lose-create', async (id) => {
          if (action === 'delete')
            await editor.api(`content/blog_articles/${id}`, undefined, 'DELETE')
          else {
            const saved = await editor.api(`content/blog_articles/${id}`)
            await editor.api(
              `content/blog_articles/${id}`,
              { slug: `${fixture.prefix}-renamed`, _rev: saved._rev },
              'PUT',
            )
            assert.equal(
              (await editor.api(`content/blog_articles/${id}`)).item.slug,
              `${fixture.prefix}-renamed`,
            )
          }
        })
        await fixture.run('run', '2100-03-01', fixture.request)
        const retry = await fixture.run('run', '2100-03-01')
        assert.equal(retry.status, 'create_unknown')
        assert.equal(retry.code, 'CREATE_ID_UNKNOWN')
        assert(!retry.id)
        const client = await cmsDraftClient(
          resolve(directory, 'agent-oauth.json'),
        )
        const items = (await client.listArticles()).filter((item) =>
          item.slug.startsWith(fixture.prefix),
        )
        assert.equal(items.length, action === 'rename' ? 1 : 0)
      } finally {
        await proxy.close()
      }
    }
  } finally {
    await editor.close()
  }
})

test('known-ID retries preserve editor rename, publication, schedule, edits and removal', async () => {
  const editor = await technicalSession(
    resolve(directory, 'browser-state.json'),
    'editor',
  )
  const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
  try {
    for (const action of ['rename', 'publish', 'schedule', 'edit', 'delete']) {
      const fixture = await dailyFixture()
      const saved = await fixture.run('run', '2100-04-01', fixture.request)
      assert.equal(saved.status, 'verified')
      const current = await editor.api(`content/blog_articles/${saved.id}`)
      if (action === 'rename')
        await editor.api(
          `content/blog_articles/${saved.id}`,
          { slug: `${fixture.prefix}-renamed`, _rev: current._rev },
          'PUT',
        )
      if (action === 'edit')
        await editor.api(
          `content/blog_articles/${saved.id}`,
          { data: { title: 'عنوان انتخابی انسان' }, _rev: current._rev },
          'PUT',
        )
      if (action === 'publish')
        await editor.api(`content/blog_articles/${saved.id}/publish`, {})
      if (action === 'schedule')
        await editor.api(`content/blog_articles/${saved.id}/schedule`, {
          scheduledAt: '2099-01-01T00:00:00.000Z',
        })
      if (action === 'delete')
        await editor.api(
          `content/blog_articles/${saved.id}`,
          undefined,
          'DELETE',
        )
      const retry = await fixture.run('run', '2100-04-01')
      assert.equal(retry.id, saved.id)
      assert.equal(retry.status, action === 'delete' ? 'removed' : 'handed_off')
      if (action === 'rename') {
        assert.equal(retry.slug, `${fixture.prefix}-renamed`)
        assert.equal(
          (await client.getArticle(saved.id)).item.slug,
          `${fixture.prefix}-renamed`,
        )
      }
      if (action === 'publish')
        assert.equal(
          (await client.getArticle(saved.id)).item.status,
          'published',
        )
      if (action === 'schedule')
        assert((await client.getArticle(saved.id)).item.scheduledAt)
      if (action === 'edit')
        assert.equal(
          (await client.getArticle(saved.id)).item.data.title,
          'عنوان انتخابی انسان',
        )
      assert.equal(
        (await client.listArticles()).filter((item) =>
          item.slug.startsWith(fixture.prefix),
        ).length,
        action === 'delete' ? 0 : 1,
      )
    }
  } finally {
    await editor.close()
  }
})

test('preview and report failures keep the saved ID while independent next dates progress', async () => {
  const proxy = await nativeFaultProxy()
  try {
    const fixture = await dailyFixture(proxy)
    proxy.fault('preview-fail')
    const failed = await fixture.run('run', '2100-05-01', fixture.request)
    assert.equal(failed.status, 'saved_needs_preview')
    assert.equal(failed.creation, 'saved')
    const recovered = await fixture.run('run', '2100-05-01')
    assert.equal(recovered.id, failed.id)
    assert.equal(recovered.status, 'verified')
    const refused = await fixture.run(
      'ack',
      '2100-05-01',
      'wrong-event',
      'not delivered',
    )
    assert.equal(refused.code, 'DELIVERY_ACK_REQUIRED')
    const pending = await fixture.run('run', '2100-05-01')
    assert.equal(pending.reported, false)
    const acknowledged = await fixture.run(
      'ack',
      '2100-05-01',
      pending.eventId,
      'fixture delivery receipt, isolated test sink',
    )
    assert.equal(acknowledged.reported, true)
    const next = await fixture.run('run', '2100-05-02', fixture.request)
    assert.equal(next.status, 'verified')
    assert.notEqual(next.id, pending.id)
    const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
    assert.equal((await client.getArticle(pending.id)).item.status, 'draft')
  } finally {
    await proxy.close()
  }
})

test('missing or corrupt registered journal stops creation instead of replacing content', async () => {
  const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
  for (const action of [
    'missing-record',
    'corrupt-record',
    'missing-manifest',
    'corrupt-manifest',
  ]) {
    const fixture = await dailyFixture()
    const saved = await fixture.run('run', '2100-06-01', fixture.request)
    const target = resolve(
      fixture.journal,
      action.endsWith('manifest') ? 'manifest.json' : '2100-06-01.json',
    )
    if (action.startsWith('missing')) await unlink(target)
    else await writeFile(target, 'broken JSON', { mode: 0o600 })
    const retry = await fixture.run('run', '2100-06-01', fixture.request)
    assert.equal(retry.status, 'blocked')
    assert.match(retry.code, /DAILY_(JOURNAL|MANIFEST)_MISSING_OR_CORRUPT/)
    assert.equal(
      (await client.listArticles()).filter((item) =>
        item.slug.startsWith(fixture.prefix),
      ).length,
      1,
    )
    assert.equal((await client.getArticle(saved.id)).item.status, 'draft')
  }
})

test('lost update reconciles the intended revision, while a native stale revision hands off human changes', async () => {
  const proxy = await nativeFaultProxy()
  const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
  try {
    const fixture = await dailyFixture(proxy)
    const saved = await fixture.run('run', '2100-07-01', fixture.request)
    const patch = resolve(root, 'patch.json')
    await writePrivateJson(patch, {
      data: { title: 'عنوان اصلاح‌شده نویسنده' },
    })
    proxy.fault('lose-update')
    const failed = await fixture.run('revise', '2100-07-01', patch)
    assert.equal(failed.status, 'saved_needs_read')
    assert.equal(failed.id, saved.id)
    const updated = await client.getArticle(saved.id)
    assert.equal(updated.item.data.title, 'عنوان اصلاح‌شده نویسنده')
    const reconciled = await fixture.run('run', '2100-07-01')
    assert.equal(reconciled.status, 'verified')
    assert.equal((await client.getArticle(saved.id))._rev, updated._rev)
    const author = await technicalSession(
      resolve(directory, 'agent-browser-state.json'),
      'author',
    )
    try {
      proxy.fault('stale-update', async (args) => {
        const current = await author.api(`content/blog_articles/${args.id}`)
        await author.api(
          `content/blog_articles/${args.id}`,
          {
            _rev: current._rev,
            data: { title: 'ویرایش انسان میان خواندن و نوشتن' },
          },
          'PUT',
        )
      })
      await writePrivateJson(patch, {
        data: { title: 'این تغییر نباید ذخیره شود' },
      })
      const stale = await fixture.run('revise', '2100-07-01', patch)
      assert.equal(stale.status, 'saved_needs_read')
      assert.equal(stale.code, 'CONFLICT')
      const handoff = await fixture.run('run', '2100-07-01')
      assert.equal(handoff.status, 'handed_off')
      assert.equal(
        (await client.getArticle(saved.id)).item.data.title,
        'ویرایش انسان میان خواندن و نوشتن',
      )
    } finally {
      await author.close()
    }
  } finally {
    await proxy.close()
  }
})

test('lost media response deduplicates frozen bytes and retains provider URLs across daily deliveries', async () => {
  const proxy = await nativeFaultProxy()
  try {
    const fixture = await dailyFixture(proxy)
    const image = resolve(root, 'daily-media.png')
    await sharp({
      create: { width: 48, height: 32, channels: 3, background: '#7a2a40' },
    })
      .png()
      .toFile(image)
    const request = await readPrivateJson(fixture.request)
    await writePrivateJson(fixture.request, {
      ...request,
      media: { path: image, alt: 'تصویر آزمایشی تک‌رنگ برای آزمون رسانه' },
    })
    proxy.fault('lose-upload')
    const failed = await fixture.run('run', '2100-08-01', fixture.request)
    assert.equal(failed.status, 'creation_failed')
    assert.equal(failed.creation, 'absent')
    const saved = await fixture.run('run', '2100-08-01')
    assert.equal(saved.status, 'verified')
    const first = await readPrivateJson(
      resolve(fixture.journal, '2100-08-01.json'),
    )
    const next = await fixture.run('run', '2100-08-02', fixture.request)
    assert.equal(next.status, 'verified')
    const second = await readPrivateJson(
      resolve(fixture.journal, '2100-08-02.json'),
    )
    assert.equal(first.media.id, second.media.id)
    const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
    const item = (await client.getArticle(saved.id)).item
    assert.equal(item.data.cover.id, first.media.id)
    assert.equal(
      item.data.body.find((node) => node._type === 'image').asset._ref,
      first.media.id,
    )
    const response = await fetch(
      new URL(first.media.url, 'http://localhost:3301'),
    )
    assert.equal(response.status, 200)
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata()
    assert.deepEqual([metadata.width, metadata.height], [48, 32])
  } finally {
    await proxy.close()
  }
})

test('native upload and create receipts survive failed follow-on reads, and an expired preview renews by saved ID', async () => {
  const proxy = await nativeFaultProxy()
  try {
    const fixture = await dailyFixture(proxy)
    const image = resolve(root, 'receipt-media.png')
    await sharp({
      create: { width: 49, height: 33, channels: 3, background: '#7a2a40' },
    })
      .png()
      .toFile(image)
    await writePrivateJson(fixture.request, {
      ...payload,
      media: { path: image, alt: 'رسانه آزمایشی رسید ذخیره' },
    })
    proxy.fault('read-after-upload')
    const failedMedia = await fixture.run('run', '2100-09-01', fixture.request)
    assert.equal(failedMedia.creation, 'absent')
    const before = await readPrivateJson(
      resolve(fixture.journal, '2100-09-01.json'),
    )
    assert(before.media.id && before.media.url)
    proxy.fault('read-after-create')
    const failedRead = await fixture.run('run', '2100-09-01')
    assert.equal(failedRead.status, 'saved_needs_read')
    assert.equal(failedRead.creation, 'saved')
    assert(failedRead.id && !failedRead.reported)
    proxy.fault(undefined)
    const saved = await fixture.run('run', '2100-09-01')
    assert.equal(saved.status, 'verified')
    assert.equal(saved.id, failedRead.id)
    const acknowledged = await fixture.run(
      'ack',
      '2100-09-01',
      saved.eventId,
      'isolated fixture delivery receipt before expiry',
    )
    assert.equal(acknowledged.reported, true)
    const recordPath = resolve(fixture.journal, '2100-09-01.json')
    const record = await readPrivateJson(recordPath)
    assert.equal(record.media.id, before.media.id)
    record.preview.expiresAt = 1
    await writePrivateJson(recordPath, record)
    const renewed = await fixture.run('run', '2100-09-01')
    assert.equal(renewed.status, 'verified')
    assert.equal(renewed.id, saved.id)
    assert.notEqual(renewed.eventId, saved.eventId)
    assert.equal(renewed.reported, false)
    assert(renewed.previewExpiry * 1000 > Date.now())
    const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
    assert.equal(
      (await client.listArticles()).filter((item) =>
        item.slug.startsWith(fixture.prefix),
      ).length,
      1,
    )
  } finally {
    await proxy.close()
  }
})

test('an editor UI-style staged slug revision is preserved even when normal reads hide that slug', async () => {
  const fixture = await dailyFixture()
  const saved = await fixture.run('run', '2100-10-01', fixture.request)
  assert.equal(saved.status, 'verified')
  const editor = await technicalSession(
    resolve(directory, 'browser-state.json'),
    'editor',
  )
  try {
    const current = await editor.api(`content/blog_articles/${saved.id}`)
    const slug = `${fixture.prefix}-staged`
    await editor.api(
      `content/blog_articles/${saved.id}`,
      { data: {}, slug, _rev: current._rev },
      'PUT',
    )
    const changed = await editor.api(`content/blog_articles/${saved.id}`)
    assert.equal(changed.item.slug, current.item.slug)
    assert.notEqual(changed._rev, current._rev)
    const revisions = await editor.api(
      `content/blog_articles/${saved.id}/revisions`,
    )
    assert.equal(
      revisions.items.find((item) => item.id === changed.item.draftRevisionId)
        .data._slug,
      slug,
    )
    const retry = await fixture.run('run', '2100-10-01')
    assert.equal(retry.id, saved.id)
    assert.equal(retry.status, 'handed_off')
    const after = await editor.api(`content/blog_articles/${saved.id}`)
    assert.equal(after._rev, changed._rev)
    assert.equal(
      (
        await editor.api(`content/blog_articles/${saved.id}/revisions`)
      ).items.find((item) => item.id === after.item.draftRevisionId).data._slug,
      slug,
    )
    assert.equal(
      (await fetch(`http://localhost:3301/blog/${slug}`)).status,
      404,
    )
  } finally {
    await editor.close()
  }
})

test('a staged editor revision between create and first read cannot be mistaken for the original delivery', async () => {
  const editor = await technicalSession(
    resolve(directory, 'browser-state.json'),
    'editor',
  )
  try {
    for (const mode of ['edit-after-create', 'lose-create']) {
      const proxy = await nativeFaultProxy()
      try {
        const fixture = await dailyFixture(proxy)
        proxy.fault(mode, async (id) => {
          const current = await editor.api(`content/blog_articles/${id}`)
          await editor.api(
            `content/blog_articles/${id}`,
            { data: {}, slug: `${fixture.prefix}-staged`, _rev: current._rev },
            'PUT',
          )
        })
        const first = await fixture.run('run', '2100-11-01', fixture.request)
        const result =
          mode === 'lose-create'
            ? await fixture.run('run', '2100-11-01')
            : first
        assert.equal(result.status, 'handed_off')
        assert(result.id)
        const client = await cmsDraftClient(
          resolve(directory, 'agent-oauth.json'),
        )
        const current = await client.getArticle(result.id)
        assert.equal(current.item.status, 'draft')
        assert(current.item.draftRevisionId)
        assert.equal(
          (await client.listArticles()).filter((item) =>
            item.slug.startsWith(fixture.prefix),
          ).length,
          1,
        )
        assert.equal(
          (
            await editor.api(`content/blog_articles/${result.id}/revisions`)
          ).items.find((item) => item.id === current.item.draftRevisionId).data
            ._slug,
          `${fixture.prefix}-staged`,
        )
      } finally {
        await proxy.close()
      }
    }
  } finally {
    await editor.close()
  }
})

test('an independent process waits for the journal lock and continues after its owner crashes', async () => {
  const fixture = await dailyFixture()
  const holder = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import{withProcessLock}from'./scripts/process-lock.mjs';
    await withProcessLock(process.argv[1],async()=>{
      setInterval(()=>{},1000);
      console.log('held');await new Promise(()=>{});
    });
  `,
      resolve(fixture.journal, 'journal.lock'),
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  )
  // An unresolved Promise alone doesn't keep Node alive; the fixture owns a
  // timer while holding the descriptor, then SIGKILL proves kernel release.
  try {
    await new Promise((done, reject) => {
      holder.stdout.once('data', done)
      holder.once('error', reject)
      holder.once('exit', () =>
        reject(new Error('Lock holder exited before acquisition')),
      )
    })
    let completed = false
    const attempt = fixture
      .run('run', '2100-12-01', fixture.request)
      .then((result) => {
        completed = true
        return result
      })
    await setTimeout(200)
    assert.equal(completed, false)
    holder.kill('SIGKILL')
    const saved = await attempt
    assert.equal(saved.status, 'verified')
    assert(saved.id)
  } finally {
    holder.kill('SIGKILL')
  }
})

test('an unavailable connection reports creation absent and pending, then retries the frozen date', async () => {
  const proxy = await nativeFaultProxy()
  try {
    const fixture = await dailyFixture(proxy)
    proxy.fault('connect-fail')
    const failed = await fixture.run('run', '2101-01-01', fixture.request)
    assert.equal(failed.status, 'creation_failed')
    assert.equal(failed.creation, 'absent')
    assert.equal(failed.code, 'MCP_HTTP_503')
    assert(!failed.id && !failed.reported)
    const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
    assert.equal(
      (await client.listArticles()).filter((item) =>
        item.slug.startsWith(fixture.prefix),
      ).length,
      0,
    )
    const saved = await fixture.run('run', '2101-01-01')
    assert.equal(saved.status, 'verified')
    const journal = await readPrivateJson(
      resolve(fixture.journal, '2101-01-01.json'),
    )
    assert.equal(
      journal.reports.find((item) => item.id === failed.eventId).status,
      'pending',
    )
    assert.equal(journal.payload.data.title, payload.data.title)
  } finally {
    await proxy.close()
  }
})
