#!/usr/bin/env node
// A retained first batch, not a recurring job. Reopening never overwrites CMS edits.
import assert from 'node:assert/strict'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
} from './cms-draft-client.mjs'

const [directory] = process.argv.slice(2)
try {
  assert(
    directory && resolve(directory) === directory,
    'Absolute private directory required',
  )
  const articles = JSON.parse(
    await readFile(
      new URL('../content/blog-launch/articles.json', import.meta.url),
      'utf8',
    ),
  )
  assert.equal(articles.length, 3)
  const delivered = JSON.parse(
    await readFile(
      new URL('../content/blog-launch/delivery.json', import.meta.url),
      'utf8',
    ),
  )
  const identity = await readPrivateJson(resolve(directory, 'agent-oauth.json'))
  assert.equal(
    identity.baseURL,
    delivered.origin,
    'Use the original retained CMS copy',
  )
  const path = resolve(directory, 'launch-batch.json')
  const batch = await readPrivateJson(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    return { batch: 'BL-0099', articles: delivered.articles }
  })
  assert.equal(batch.batch, 'BL-0099')
  for (const article of articles) {
    batch.articles[article.key] ??= delivered.articles[article.key]
    assert.equal(
      batch.articles[article.key].id,
      delivered.articles[article.key].id,
      'Preserve the original delivered CMS identity',
    )
  }
  const client = await cmsDraftClient(resolve(directory, 'agent-oauth.json'))
  await client.connect()
  const inventory = await client.listArticles()
  await writePrivateJson(resolve(directory, 'launch-overlap-current.json'), {
    checkedAt: new Date().toISOString(),
    items: inventory,
  })
  for (const article of articles) {
    const matches = inventory.filter((item) => item.slug === article.slug)
    assert(
      matches.length <= 1,
      'Resolve duplicate launch slugs before delivery',
    )
    const saved = await client.getArticle(batch.articles[article.key].id)
    assert.equal(
      saved.item.authorId,
      identity.userId,
      'Existing batch article must belong to dedicated Author',
    )
    assert.equal(
      saved.item.slug,
      article.slug,
      'Keep the recorded first-batch slug',
    )
    assert.equal(
      saved.item.status,
      'draft',
      'Do not replace or withdraw published batch content',
    )
    assert(
      !saved.item.liveRevisionId && !saved.item.scheduledAt,
      'Only unscheduled unpublished drafts belong to delivery',
    )
    batch.articles[article.key] = {
      id: saved.item.id,
      slug: saved.item.slug,
      ...(await client.preview(saved.item.id)),
    }
    await writePrivateJson(path, batch)
    console.log(
      `PASS retained launch ${article.key}; native identity and private preview saved`,
    )
  }
  assert.equal(Object.keys(batch.articles).length, 3)
  const linksPath = resolve(directory, 'launch-preview-links.md')
  await writeFile(
    linksPath,
    [
      '# پیش‌نمایش سه مقاله آغازین',
      '',
      'ابتدا با حساب ویرایشگر در سامانه مدیریت محتوا وارد شوید. این پیوندهای خصوصی موقت‌اند و مقاله‌ها هنوز منتشر نشده‌اند.',
      '',
      ...articles.map(
        (article) => `- [${article.title}](${batch.articles[article.key].url})`,
      ),
      '',
    ].join('\n'),
    { mode: 0o600 },
  )
  await chmod(linksPath, 0o600)
} catch (error) {
  console.error(
    error.code ??
      (/^CMS [A-Za-z0-9_:-]+$/.test(error.message)
        ? error.message
        : 'LAUNCH_DELIVERY_FAILED'),
  )
  process.exitCode = 1
}
