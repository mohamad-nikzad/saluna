import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
  validateDraftTitle,
} from './cms-draft-client.mjs'
import { withProcessLock } from './process-lock.mjs'
import { technicalSession } from '../deploy/cms/technical-session.mjs'
import {
  productionDraftClient,
  validatePersianSlug,
} from './cms-drafts-mcp.mjs'

const hash = (value) => createHash('sha256').update(value).digest('hex')
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  return value
}
const equal = (a, b) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
// Native REST/MCP reads encode the schema boolean as 0; query reads use false.
const matches = (actual, expected) =>
  Object.entries(expected).every(([key, value]) => {
    if (key === 'search_excluded' && value === false)
      return [false, 0].includes(actual[key])
    // The native image field read adds provider dimensions and storage metadata.
    if (key === 'cover' && value)
      return Object.entries(value).every(([field, item]) =>
        equal(actual.cover?.[field], item),
      )
    return equal(actual[key], value)
  })
const plain = (item) =>
  item.status === 'draft' && !item.liveRevisionId && !item.scheduledAt
function runDate(date) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || '') ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error('CMS DAILY_DATE_REQUIRED')
  return date
}
function article(data) {
  const keys = [
    'title',
    'summary',
    'body',
    'seo_title',
    'seo_description',
    'search_excluded',
  ]
  if (
    !data ||
    Object.keys(data).some((key) => !keys.includes(key)) ||
    ['title', 'summary', 'seo_title', 'seo_description'].some(
      (key) => !data[key]?.trim(),
    ) ||
    !Array.isArray(data.body) ||
    !data.body.length ||
    data.search_excluded !== false
  )
    throw new Error('CMS COMPLETE_DAILY_ARTICLE_REQUIRED')
  validateDraftTitle(data.title)
  return data
}
function revision(data) {
  const fields = [
    'title',
    'summary',
    'body',
    'seo_title',
    'seo_description',
    'search_excluded',
  ]
  if (
    !data ||
    !Object.keys(data).length ||
    Object.keys(data).some((key) => !fields.includes(key)) ||
    ('search_excluded' in data && data.search_excluded !== false)
  )
    throw new Error('CMS DAILY_REVISION_FIELDS_REQUIRED')
  if (Object.hasOwn(data, 'title')) validateDraftTitle(data.title)
  return data
}
function diagnostic(error) {
  if (error.cause?.code === 'ECONNREFUSED') return 'CMS_CONNECTION_REFUSED'
  if (
    error.name === 'TimeoutError' ||
    error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
  )
    return 'CMS_REQUEST_TIMEOUT'
  return /^CMS [A-Z0-9_:-]+$/.test(error.message)
    ? error.message.slice(4)
    : 'TRANSPORT_OR_STORAGE_ERROR'
}
const pathFor = (config, date) => resolve(config.journal, `${date}.json`)
async function manifest(config) {
  let value
  try {
    value = await readPrivateJson(resolve(config.journal, 'manifest.json'))
  } catch {
    throw new Error('CMS DAILY_MANIFEST_MISSING_OR_CORRUPT')
  }
  if (
    value.version !== 1 ||
    value.timezone !== 'Asia/Tehran' ||
    !Array.isArray(value.dates) ||
    new Set(value.dates).size !== value.dates.length ||
    value.dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))
  )
    throw new Error('CMS DAILY_MANIFEST_MISSING_OR_CORRUPT')
  return value
}
async function record(config, date) {
  let value
  try {
    value = await readPrivateJson(pathFor(config, date))
  } catch {
    throw new Error('CMS DAILY_JOURNAL_MISSING_OR_CORRUPT')
  }
  if (
    value.version !== 1 ||
    value.date !== date ||
    value.runId !== `blog-daily/Asia-Tehran/${date}` ||
    !value.payload?.slug ||
    !value.payload?.data ||
    !Array.isArray(value.reports)
  )
    throw new Error('CMS DAILY_JOURNAL_MISSING_OR_CORRUPT')
  return value
}
async function store(config, value) {
  await writePrivateJson(pathFor(config, value.date), value)
}
export async function dailyDraftStatus(config, date) {
  runDate(date)
  return withProcessLock(resolve(config.journal, 'journal.lock'), async () => {
    const index = await manifest(config)
    if (index.dates.includes(date)) {
      const value = await record(config, date)
      return {
        date,
        runId: value.runId,
        scheduledTime: value.scheduledTime,
        status: value.state,
        id: value.id,
        requiresInput: false,
      }
    }
    try {
      await lstat(pathFor(config, date))
      throw new Error('CMS DAILY_MANIFEST_MISSING_OR_CORRUPT')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    return {
      date,
      runId: `blog-daily/Asia-Tehran/${date}`,
      status: 'new',
      requiresInput: true,
    }
  })
}
export async function initializeDailyJournal(config) {
  try {
    await mkdir(config.journal, { mode: 0o700 })
  } catch {
    throw new Error('CMS DAILY_JOURNAL_ALREADY_EXISTS')
  }
  await writePrivateJson(resolve(config.journal, 'manifest.json'), {
    version: 1,
    timezone: 'Asia/Tehran',
    dates: [],
  })
  return { status: 'initialized', timezone: 'Asia/Tehran' }
}
async function freeze(config, date, input) {
  if (!input) throw new Error('CMS DAILY_INPUT_REQUIRED')
  const data = article(input.data)
  const credentials = await readPrivateJson(config.credentials)
  const production = config.target === 'production'
  if (
    credentials.baseURL !==
    (production ? 'https://saluna.ir' : 'http://localhost:3301')
  )
    throw new Error('CMS DAILY_ENDPOINT_CHANGED')
  if (production) validatePersianSlug(input.slug)
  const map = JSON.parse(
    await readFile(
      resolve(config.repository, 'content/blog-writing/sources.json'),
      'utf8',
    ),
  )
  if (!map.subjects[input.subject]) throw new Error('CMS UNKNOWN_SUBJECT')
  const sources = await Promise.all(
    [...map.common, ...map.subjects[input.subject]].map(async (path) => ({
      path,
      sha256: hash(await readFile(resolve(config.repository, path))),
    })),
  )
  const value = {
    version: 1,
    date,
    runId: `blog-daily/Asia-Tehran/${date}`,
    timezone: 'Asia/Tehran',
    scheduledTime: config.scheduledTime || '09:00',
    endpoint: credentials.baseURL,
    locale: 'en',
    state: 'prepared',
    reports: [],
    sources: {
      subject: input.subject,
      commit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: config.repository,
        encoding: 'utf8',
      }).trim(),
      files: sources,
    },
    payload: {
      slug: production
        ? input.slug
        : `${config.slugPrefix || 'saluna-daily'}-${date}`,
      data,
    },
  }
  if (input.media) {
    if (!input.media.alt?.trim()) throw new Error('CMS IMAGE_ALT_REQUIRED')
    const bytes = await readFile(input.media.path)
    if (bytes.length > 5 * 1024 * 1024) throw new Error('CMS IMAGE_TOO_LARGE')
    value.media = {
      ...input.media,
      path: undefined,
      extension: extname(input.media.path),
      base64: bytes.toString('base64'),
      sha256: hash(bytes),
    }
  }
  return value
}
async function report(config, value, code) {
  value.lastCode =
    code || (value.state === 'verified' ? 'OK' : value.lastCode || 'OK')
  const delivery =
    value.state === 'verified'
      ? `${value.revision}/${value.preview.expiresAt}`
      : ''
  const id = hash(
    `${value.runId}/${value.state}/${value.lastCode}/${value.id || ''}/${delivery}`,
  ).slice(0, 24)
  let event = value.reports.find((item) => item.id === id)
  if (!event) {
    event = {
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      code: value.lastCode,
    }
    value.reports.push(event)
  }
  await store(config, value)
  const reportFile = resolve(config.journal, `${value.date}.report.json`)
  const result = {
    runId: value.runId,
    date: value.date,
    timezone: value.timezone,
    scheduledTime: value.scheduledTime,
    status: value.state,
    id: value.id,
    slug: value.currentSlug || value.payload.slug,
    creation: value.id ? 'saved' : value.createStarted ? 'unknown' : 'absent',
    code: event.code,
    failureStage: value.failureStage,
    eventId: id,
    reported: event.status === 'acknowledged',
    reportFile,
    retry:
      value.state === 'create_unknown' ||
      value.state === 'removed' ||
      value.state === 'handed_off'
        ? 'operator handoff; never create replacement'
        : 'retry this original date',
    previewExpiry: value.preview?.expiresAt,
    verification: value.verification,
  }
  await writePrivateJson(reportFile, {
    ...result,
    previewUrl: value.state === 'verified' ? value.preview.url : undefined,
  })
  return result
}
async function verifyPreview(config, value, credentials) {
  if (config.target === 'production') {
    // Production has no test passkey. Verify saved delivery and anonymous
    // exclusion; an authenticated visual preview remains an editorial check.
    const request = (url) => fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (
      (await request(value.preview.url)).status !== 403 ||
      (
        await request(
          `${credentials.baseURL}/blog/${encodeURIComponent(value.currentSlug)}/`,
        )
      ).status !== 404
    )
      throw new Error('CMS DRAFT_PUBLICLY_VISIBLE')
    for (const path of ['/blog/', '/blog-sitemap.xml']) {
      const response = await request(`${credentials.baseURL}${path}`)
      const html = await response.text()
      if (
        response.status !== 200 ||
        html.includes(value.currentSlug) ||
        html.includes(encodeURIComponent(value.currentSlug))
      )
        throw new Error('CMS DRAFT_DISCOVERABLE')
    }
    value.verification = {
      savedDraft: true,
      anonymousPrivacy: true,
      authenticatedPreview: false,
    }
    return
  }
  const session = await technicalSession(config.sessionState, 'author')
  try {
    if ((await session.api('auth/me')).id !== credentials.userId)
      throw new Error('CMS PREVIEW_IDENTITY_CHANGED')
    const response = await session.page.goto(value.preview.url)
    if (
      response.status() !== 200 ||
      !/private.*no-store/.test(response.headers()['cache-control']) ||
      !/noindex/.test(response.headers()['x-robots-tag'])
    )
      throw new Error('CMS PRIVATE_PREVIEW_FAILED')
    if (
      (
        await session.page.getByRole('heading', { level: 1 }).textContent()
      ).trim() !== value.snapshot.title
    )
      throw new Error('CMS PREVIEW_CONTENT_MISMATCH')
    if (
      !(await session.page.locator('article').textContent()).includes(
        'تیم سالونا',
      )
    )
      throw new Error('CMS PREVIEW_CREDIT_MISMATCH')
    const base = credentials.baseURL
    const publicRequest = (url) =>
      fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (
      (await publicRequest(value.preview.url)).status !== 403 ||
      (
        await publicRequest(
          `${base}/blog/${encodeURIComponent(value.currentSlug)}`,
        )
      ).status !== 404
    )
      throw new Error('CMS DRAFT_PUBLICLY_VISIBLE')
    for (const path of ['/blog', '/blog-sitemap.xml']) {
      const response = await publicRequest(`${base}${path}`)
      if (
        response.status !== 200 ||
        (await response.text()).includes(value.currentSlug)
      )
        throw new Error('CMS DRAFT_DISCOVERABLE')
    }
  } finally {
    await session.close()
  }
}

/** Owns one immutable date delivery. A retry never regenerates or replaces it.
 * Journal lock spans the entire operation, with the same credential transaction
 * used by manual clients. Reporting is acknowledged separately after delivery.
 */
export async function deliverDailyDraft(config, date, input) {
  runDate(date)
  return withProcessLock(resolve(config.journal, 'journal.lock'), async () => {
    const index = await manifest(config)
    let value
    if (index.dates.includes(date)) value = await record(config, date)
    else {
      // A registered date disappearing from the manifest is corruption, not
      // authorization to overwrite its record or create another CMS entry.
      try {
        await lstat(pathFor(config, date))
        throw new Error('CMS DAILY_MANIFEST_MISSING_OR_CORRUPT')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      if (input?.patch) throw new Error('CMS DAILY_REVISION_REQUIRES_SAVED')
      value = await freeze(config, date, input)
      index.dates.push(date)
      // Registration first: a crash before the record cannot silently restart.
      await writePrivateJson(resolve(config.journal, 'manifest.json'), index)
      await store(config, value)
    }
    // Resending a terminal handoff report must not depend on CMS availability
    // or turn its preserved tombstone back into a writable retry state.
    if (['removed', 'handed_off'].includes(value.state))
      return report(config, value)
    const credentialFile = await realpath(config.credentials)
    return withProcessLock(`${credentialFile}.lock`, async () => {
      let stage = 'connect'
      try {
        const credentials = await readPrivateJson(credentialFile)
        if (
          credentials.baseURL !== value.endpoint ||
          credentials.locale !== value.locale
        )
          throw new Error('CMS DAILY_ENDPOINT_CHANGED')
        const client = await (
          config.target === 'production'
            ? productionDraftClient
            : cmsDraftClient
        )(credentialFile)
        await client.connect()
        if (input?.patch) {
          if (!value.snapshot || !value.id)
            throw new Error('CMS DAILY_REVISION_REQUIRES_SAVED')
          const patch = revision(input.patch)
          if (value.pending && !equal(value.pending.data, patch))
            throw new Error('CMS DAILY_PENDING_REVISION_EXISTS')
          value.pending ||= {
            data: patch,
            desired: { ...value.snapshot, ...patch },
            started: false,
          }
          await store(config, value)
        }
        if (
          !value.overlap ||
          (config.target === 'production' && !value.createStarted)
        ) {
          value.overlap = {
            readAt: new Date().toISOString(),
            items: (await client.listArticles()).map(
              ({ id, slug, status, data }) => ({
                id,
                slug,
                status,
                title: data?.title,
                summary: data?.summary,
              }),
            ),
          }
          await store(config, value)
        }
        if (
          !value.createStarted &&
          config.target === 'production' &&
          value.overlap.items.some((item) => item.slug === value.payload.slug)
        )
          throw new Error('CMS DRAFT_SLUG_COLLISION')
        if (value.media && !value.createStarted) {
          stage = 'media'
          if (!value.media.id) {
            const image = resolve(
              config.journal,
              `${date}${value.media.extension}`,
            )
            await writeFile(image, Buffer.from(value.media.base64, 'base64'), {
              mode: 0o600,
            })
            await client.uploadImage(
              image,
              { alt: value.media.alt, caption: value.media.caption },
              async (saved) => {
                value.media.id = saved.item.id
                value.media.url = saved.item.url
                await store(config, value)
              },
            )
          } else await client.getMedia(value.media.id)
          value.payload.data.cover = {
            provider: 'local',
            id: value.media.id,
            alt: value.media.alt,
          }
          value.payload.data.body = [
            ...value.payload.data.body.filter(
              (item) => item._key !== 'daily-media',
            ),
            {
              _type: 'image',
              _key: 'daily-media',
              asset: {
                _type: 'reference',
                _ref: value.media.id,
                url: value.media.url,
              },
              alt: value.media.alt,
            },
          ]
          await store(config, value)
        }
        stage = 'create'
        if (!value.createStarted) {
          value.createStarted = true
          value.state = 'create_started'
          await store(config, value)
          await client.createDraft(value.payload, async (saved) => {
            value.id = saved.item.id
            value.state = 'saved_needs_read'
            value.revision = saved._rev
            await store(config, value)
          })
        }
        stage = 'reconcile'
        let current
        if (!value.id) {
          try {
            current = await client.getArticle(value.payload.slug)
          } catch (error) {
            if (error.message !== 'CMS NOT_FOUND') throw error
          }
          if (
            !current ||
            current.item.authorId !== credentials.userId ||
            current.item.locale !== value.locale ||
            !matches(current.item.data, value.payload.data)
          ) {
            value.state = 'create_unknown'
            return report(config, value, 'CREATE_ID_UNKNOWN')
          }
          value.id = current.item.id
          await store(config, value)
          if (
            current.item.draftRevisionId ||
            Number(current.item.version) !== 1
          ) {
            value.state = 'handed_off'
            return report(config, value, 'EDITOR_CHANGED_OR_RELEASED')
          }
        }
        try {
          current = await client.getArticle(value.id)
        } catch (error) {
          if (error.message !== 'CMS NOT_FOUND') throw error
          value.state = 'removed'
          return report(config, value, 'EDITOR_REMOVED')
        }
        value.currentSlug = current.item.slug
        if (
          value.pending &&
          matches(current.item.data, value.pending.desired)
        ) {
          value.snapshot = current.item.data
          value.revision = current._rev
          if (value.preview) value.preview.verified = false
          delete value.pending
        }
        if (
          current.item.authorId !== credentials.userId ||
          current.item.locale !== value.locale ||
          !plain(current.item) ||
          (value.revision && value.revision !== current._rev) ||
          (value.snapshot
            ? !equal(current.item.data, value.snapshot)
            : !matches(current.item.data, value.payload.data))
        ) {
          value.state = 'handed_off'
          return report(config, value, 'EDITOR_CHANGED_OR_RELEASED')
        }
        if (value.pending) {
          stage = 'update'
          value.pending.started = true
          await store(config, value)
          current = await client.reviseDraft(current, value.pending.data)
          if (value.preview) value.preview.verified = false
          delete value.pending
        }
        value.snapshot = current.item.data
        value.revision = current._rev
        value.state = 'saved_needs_preview'
        await store(config, value)
        stage = 'preview'
        if (
          !value.preview ||
          value.preview.slug !== value.currentSlug ||
          value.preview.expiresAt * 1000 < Date.now() + 5 * 60_000
        ) {
          value.preview = {
            ...(await client.preview(value.id)),
            slug: value.currentSlug,
          }
          await store(config, value)
          await verifyPreview(config, value, credentials)
          value.preview.verified = true
        } else if (!value.preview.verified) {
          await verifyPreview(config, value, credentials)
          value.preview.verified = true
        }
        value.state = 'verified'
        delete value.failureStage
        return report(config, value)
      } catch (error) {
        value.failureStage = stage
        value.state = value.id
          ? stage === 'preview'
            ? 'saved_needs_preview'
            : 'saved_needs_read'
          : value.createStarted
            ? 'create_unknown'
            : 'creation_failed'
        return report(config, value, diagnostic(error))
      }
    })
  })
}

export async function acknowledgeDailyReport(config, date, eventId, receipt) {
  runDate(date)
  return withProcessLock(resolve(config.journal, 'journal.lock'), async () => {
    await manifest(config)
    const value = await record(config, date)
    const event = value.reports.find((item) => item.id === eventId)
    if (!event || !receipt?.trim()) throw new Error('CMS DELIVERY_ACK_REQUIRED')
    event.status = 'acknowledged'
    event.receipt = receipt
    await store(config, value)
    return report(config, value)
  })
}
