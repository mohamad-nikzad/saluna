#!/usr/bin/env node
// A narrow Mac command for Studio. OAuth and preview links never enter stdout.
import { readFile, lstat, chmod } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
  DRAFT_SCOPES,
} from './cms-draft-client.mjs'

const [configFile, action, input] = process.argv.slice(2)
async function exchangeFile(directory, name) {
  if (
    !name ||
    basename(name) !== name ||
    !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(name)
  )
    throw new Error('CMS EXCHANGE_FILE_REQUIRED')
  const path = resolve(directory, name)
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size > 5 * 1024 * 1024)
    throw new Error('CMS EXCHANGE_FILE_REQUIRED')
  await chmod(path, 0o600)
  return path
}
function articleFields(data, complete = false) {
  const fields = [
    'title',
    'summary',
    'body',
    'cover',
    'seo_title',
    'seo_description',
    'search_excluded',
  ]
  if (!data || Object.keys(data).some((key) => !fields.includes(key)))
    throw new Error('CMS ARTICLE_FIELDS_REQUIRED')
  if (
    complete &&
    (!data.title?.trim() ||
      !data.summary?.trim() ||
      !data.seo_title?.trim() ||
      !data.seo_description?.trim() ||
      !Array.isArray(data.body) ||
      !data.body.length)
  )
    throw new Error('CMS COMPLETE_ARTICLE_REQUIRED')
  return data
}
function savedDraft(current) {
  return { _rev: current._rev, item: current.item }
}
try {
  const config = await readPrivateJson(configFile)
  const sources = JSON.parse(
    await readFile(
      resolve(config.repository, 'content/blog-writing/sources.json'),
      'utf8',
    ),
  )
  if (action === 'sources') {
    if (!sources.subjects[input]) throw new Error('CMS UNKNOWN_SUBJECT')
    const files = await Promise.all(
      [...sources.common, ...sources.subjects[input]].map(async (path) => {
        const content = await readFile(resolve(config.repository, path), 'utf8')
        return {
          path,
          sha256: createHash('sha256').update(content).digest('hex'),
          content,
        }
      }),
    )
    console.log(
      JSON.stringify({
        commit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: config.repository,
          encoding: 'utf8',
        }).trim(),
        subject: input,
        files,
      }),
    )
  } else {
    const client = await cmsDraftClient(config.credentials)
    const discovery = await client.connect()
    let result
    switch (action) {
      case 'inventory': {
        const items = await client.listArticles()
        result = {
          connection: { expectedRole: 'Author 30', scopes: DRAFT_SCOPES },
          tools: discovery.tools.map((tool) => tool.name),
          catalogueNote:
            'Native tools/list is a catalogue, not granted permissions. This wrapper never forwards publish, schedule, delete, administration or schema actions.',
          actions: [
            'inventory',
            'sources',
            'read',
            'create',
            'revise',
            'upload',
            'media',
            'preview',
          ],
          items: items.map(({ id, slug, status, locale, data }) => ({
            id,
            slug,
            status,
            locale,
            title: data?.title,
            summary: data?.summary,
          })),
        }
        break
      }
      case 'read':
        result = savedDraft(await client.getArticle(input))
        break
      case 'create': {
        const request = await readPrivateJson(
          await exchangeFile(config.exchange, input),
        )
        result = savedDraft(
          await client.createDraft({
            slug: request.slug,
            data: articleFields(request.data, true),
          }),
        )
        await writePrivateJson(resolve(config.results, 'created.json'), result)
        break
      }
      case 'revise': {
        const request = await readPrivateJson(
          await exchangeFile(config.exchange, input),
        )
        const current = await client.getArticle(request.id)
        if (!request._rev || current._rev !== request._rev)
          throw new Error('CMS STALE_REVISION')
        result = savedDraft(
          await client.reviseDraft(current, articleFields(request.data)),
        )
        await writePrivateJson(resolve(config.results, 'revised.json'), result)
        break
      }
      case 'upload': {
        const request = await readPrivateJson(
          await exchangeFile(config.exchange, input),
        )
        const path = await exchangeFile(config.exchange, request.image)
        if (!request.alt?.trim()) throw new Error('CMS IMAGE_ALT_REQUIRED')
        result = await client.uploadImage(path, {
          alt: request.alt,
          caption: request.caption,
        })
        await writePrivateJson(resolve(config.results, 'uploaded.json'), result)
        break
      }
      case 'media':
        result = await client.getMedia(input)
        break
      case 'preview': {
        if (!/^[A-Za-z0-9]+$/.test(input || ''))
          throw new Error('CMS CONTENT_ID_REQUIRED')
        const current = await client.getArticle(input)
        if (
          current.item.status !== 'draft' ||
          current.item.liveRevisionId ||
          current.item.scheduledAt
        )
          throw new Error('CMS NOT_PLAIN_DRAFT')
        const preview = await client.preview(current.item.id)
        const previewFile = resolve(
          config.results,
          `preview-${current.item.id}.json`,
        )
        await writePrivateJson(previewFile, { ...preview, item: current.item })
        result = {
          id: current.item.id,
          slug: current.item.slug,
          status: 'draft',
          expiresAt: preview.expiresAt,
          previewFile,
        }
        break
      }
      default:
        throw new Error('CMS UNKNOWN_ACTION')
    }
    console.log(JSON.stringify(result))
  }
} catch (error) {
  console.error(
    /^CMS [A-Z0-9_:-]+$/.test(error.message)
      ? error.message
      : 'CMS STUDIO_CLIENT_ERROR',
  )
  process.exitCode = 1
}
