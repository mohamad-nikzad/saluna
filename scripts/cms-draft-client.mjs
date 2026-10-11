import {
  chmod,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { withProcessLock } from './process-lock.mjs'

export const DRAFT_SCOPES = [
  'content:read',
  'content:write',
  'media:read',
  'media:write',
]

// Visible article headings have a mobile reading budget. SEO titles are separate.
export function validateDraftTitle(title) {
  if (typeof title !== 'string' || !title.trim())
    throw new Error('CMS DRAFT_TITLE_REQUIRED')
  if (Array.from(title.trim().normalize('NFC')).length > 50)
    throw new Error('CMS DRAFT_TITLE_TOO_LONG')
}

export function cmsOrigin(value) {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('CMS INVALID_ORIGIN')
  return url.origin
}
function json(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('CMS INVALID_RESPONSE')
  }
}
export async function readPrivateJson(path) {
  if (resolve(path) !== path || (await stat(path)).mode & 0o077)
    throw new Error('CMS PRIVATE_FILE_REQUIRED')
  return json(await readFile(path, 'utf8'))
}
export async function writePrivateJson(path, value) {
  if (resolve(path) !== path) throw new Error('CMS ABSOLUTE_PATH_REQUIRED')
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(JSON.stringify(value, null, 2))
      await file.sync()
    } finally {
      await file.close()
    }
    await rename(temporary, path)
    await chmod(path, 0o600)
    const directory = await open(dirname(path), 'r')
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  } finally {
    await unlink(temporary).catch(() => {})
  }
}

/** Stateless native MCP plus the supported preview REST adjunct. Writes are
 * explicit unscheduled drafts; native Author permissions remain unchanged.
 * Processes serialize this credential file, reloading each native rotation.
 * No content mutation is retried inside the client.
 */
export async function cmsDraftClient(
  credentialFile,
  { collection = 'blog_articles' } = {},
) {
  if (!['blog_articles', 'product_guides'].includes(collection))
    throw new Error('CMS INVALID_DRAFT_COLLECTION')
  credentialFile = await realpath(credentialFile)
  let credentials = await readPrivateJson(credentialFile)
  const base = cmsOrigin(credentials.baseURL)
  if (
    !credentials.locale ||
    credentials.role !== 30 ||
    JSON.stringify(credentials.scope?.split(' ').sort()) !==
      JSON.stringify([...DRAFT_SCOPES].sort())
  )
    throw new Error('CMS AUTHOR_FOUR_SCOPES_REQUIRED')
  let sequence = 0,
    refreshing
  async function refresh() {
    const response = await fetch(
      new URL('/_emdash/api/oauth/token/refresh', base),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: credentials.refresh_token,
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )
    const result = json(await response.text())
    if (!response.ok || !result.success)
      throw new Error(`CMS REFRESH_HTTP_${response.status}`)
    if (
      JSON.stringify(result.data.scope.split(' ').sort()) !==
      JSON.stringify([...DRAFT_SCOPES].sort())
    )
      throw new Error('CMS SCOPE_CHANGED')
    credentials = {
      ...credentials,
      ...result.data,
      expiresAt: Date.now() + result.data.expires_in * 1000,
    }
    await writePrivateJson(credentialFile, credentials)
  }
  async function token() {
    if (!Number.isFinite(credentials.expiresAt))
      throw new Error('CMS TOKEN_EXPIRY_REQUIRED')
    if (credentials.expiresAt <= Date.now() + 30_000) {
      if (credentials.tokenType === 'pat') throw new Error('CMS TOKEN_EXPIRED')
      refreshing ??= refresh().finally(() => {
        refreshing = undefined
      })
      await refreshing
    }
    return credentials.access_token
  }
  async function request(path, options = {}) {
    return fetch(new URL(path, base), {
      ...options,
      headers: { Authorization: `Bearer ${await token()}`, ...options.headers },
      signal: AbortSignal.timeout(30_000),
    })
  }
  async function rpc(method, params) {
    const id = ++sequence
    const response = await request('/_emdash/api/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
    if (!response.ok) throw new Error(`CMS MCP_HTTP_${response.status}`)
    const text = await response.text()
    const messages = response.headers
      .get('content-type')
      ?.includes('text/event-stream')
      ? text
          .split(/\r?\n\r?\n/)
          .map((event) =>
            event
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n'),
          )
          .filter(Boolean)
          .map(json)
      : [json(text)]
    const message = messages.find((value) => value.id === id)
    if (!message || message.error)
      throw new Error(`CMS RPC_${message?.error?.code ?? 'INVALID_RESPONSE'}`)
    return message.result
  }
  async function tool(name, args) {
    const result = await rpc('tools/call', { name, arguments: args })
    if (result.isError)
      throw new Error(
        `CMS ${result._meta?.code ?? result.content?.[0]?.text?.match(/^\[([A-Z_]+)\]/)?.[1] ?? 'TOOL_ERROR'}`,
      )
    return json(result.content.find((part) => part.type === 'text').text)
  }
  const getArticle = (id) =>
    tool('content_get', {
      collection,
      id,
      locale: credentials.locale,
    })
  function ownDraft(current) {
    if (!current?._rev || !current.item?.id)
      throw new Error('CMS READ_BEFORE_REVISION')
    if (
      current.item.status !== 'draft' ||
      current.item.liveRevisionId ||
      current.item.scheduledAt
    )
      throw new Error('CMS NOT_PLAIN_DRAFT')
    if (current.item.authorId !== credentials.userId)
      throw new Error('CMS NOT_OWN_DRAFT')
    if (current.item.locale !== credentials.locale)
      throw new Error('CMS LOCALE_CHANGED')
    return current
  }
  const operations = {
    async connect() {
      await rpc('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'saluna-drafts', version: '1' },
      })
      return rpc('tools/list', {})
    },
    async listArticles() {
      const items = [],
        seen = new Set()
      let cursor
      do {
        const page = await tool('content_list', {
          collection,
          locale: credentials.locale,
          limit: 100,
          ...(cursor ? { cursor } : {}),
        })
        items.push(...page.items)
        cursor = page.nextCursor
        if (cursor && seen.has(cursor)) throw new Error('CMS INVALID_CURSOR')
        seen.add(cursor)
      } while (cursor)
      return items
    },
    async createDraft({ slug, data }, onSaved = async () => {}) {
      if (!slug) throw new Error('CMS DRAFT_TITLE_SLUG_REQUIRED')
      validateDraftTitle(data?.title)
      const created = await tool('content_create', {
        collection,
        slug,
        data,
        locale: credentials.locale,
        status: 'draft',
      })
      // Receipts must reach durable storage before a later read can fail.
      await onSaved(created)
      return ownDraft(await getArticle(created.item.id))
    },
    getArticle,
    async reviseDraft(current, data) {
      ownDraft(current)
      if (Object.hasOwn(data, 'title')) validateDraftTitle(data.title)
      await tool('content_update', {
        collection,
        id: current.item.id,
        data,
        locale: credentials.locale,
        _rev: current._rev,
        status: 'draft',
      })
      return ownDraft(await getArticle(current.item.id))
    },
    async uploadImage(path, metadata = {}, onSaved = async () => {}) {
      const contentType = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.avif': 'image/avif',
      }[extname(path).toLowerCase()]
      if (!contentType) throw new Error('CMS UNSUPPORTED_IMAGE')
      const uploaded = await tool('media_upload', {
        filename: basename(path),
        base64: (await readFile(path)).toString('base64'),
        contentType,
        alt: metadata.alt,
        caption: metadata.caption,
      })
      await onSaved(uploaded)
      const saved = await tool('media_get', { id: uploaded.item.id })
      return { ...saved, item: { ...saved.item, url: uploaded.item.url } }
    },
    getMedia: (id) => tool('media_get', { id }),
    async preview(id) {
      ownDraft(await getArticle(id))
      const response = await request(
        `/_emdash/api/content/${collection}/${encodeURIComponent(id)}/preview-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-EmDash-Request': '1',
          },
          body: '{}',
        },
      )
      const result = json(await response.text())
      if (!response.ok || !result.success)
        throw new Error(`CMS PREVIEW_HTTP_${response.status}`)
      const url = new URL(result.data.url, base)
      if (url.origin !== base) throw new Error('CMS PREVIEW_ORIGIN_CHANGED')
      return { ...result.data, url: url.href }
    },
  }
  return Object.fromEntries(
    Object.entries(operations).map(([name, operation]) => [
      name,
      (...args) =>
        withProcessLock(`${credentialFile}.lock`, async () => {
          // Another process may have refreshed and rotated this native grant.
          credentials = await readPrivateJson(credentialFile)
          return operation(...args)
        }),
    ]),
  )
}
