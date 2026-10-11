import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { cmsDraftClient } from './cms-draft-client.mjs'

const collectionSchema = {
  type: 'string',
  enum: ['blog_articles', 'product_guides'],
}
const dataSchema = { type: 'object', additionalProperties: true }
const tools = [
  [
    'drafts_list',
    'List permitted published content and drafts for topic overlap.',
    { collection: collectionSchema },
    ['collection'],
    true,
  ],
  [
    'draft_get',
    'Read an entry and its current native revision token.',
    { collection: collectionSchema, id: { type: 'string' } },
    ['collection', 'id'],
    true,
  ],
  [
    'draft_create',
    'Create one unpublished, unscheduled Persian Blog Article or Product Guide. Provide a descriptive Persian slug and complete revisioned fields. Never publishes.',
    {
      collection: collectionSchema,
      slug: { type: 'string' },
      data: dataSchema,
    },
    ['collection', 'slug', 'data'],
    false,
  ],
  [
    'draft_revise',
    "Revise this connection's own plain draft using the revision returned by draft_get. Published, scheduled and other writers' entries are refused. Never publishes or renames a public URL.",
    {
      collection: collectionSchema,
      id: { type: 'string' },
      _rev: { type: 'string' },
      data: dataSchema,
    },
    ['collection', 'id', '_rev', 'data'],
    false,
  ],
  [
    'media_get',
    'Read one permitted CMS media record.',
    { id: { type: 'string' } },
    ['id'],
    true,
  ],
  [
    'media_upload',
    'Upload an approved local image to production CMS media. Use an absolute image path and truthful Persian alt text and caption.',
    {
      path: { type: 'string' },
      alt: { type: 'string' },
      caption: { type: 'string' },
    },
    ['path', 'alt'],
    false,
  ],
  [
    'draft_preview',
    "Obtain a private signed preview link for this connection's own plain draft. Viewing it still requires a native CMS browser session.",
    { collection: collectionSchema, id: { type: 'string' } },
    ['collection', 'id'],
    false,
  ],
].map(([name, description, properties, required, readOnlyHint]) => ({
  name,
  description,
  inputSchema: {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  },
  annotations: { readOnlyHint, destructiveHint: false, openWorldHint: true },
}))

// This boundary owns the draft-only policy. The native minimum editing role
// also allows own publication, so a raw token or filtered native tool list is
// insufficient. No caller can select a status or invoke a publishing operation.
export function draftMcpOperations(clients) {
  const ownDraft = (current) => {
    if (
      !current?._rev ||
      current.item?.status !== 'draft' ||
      current.item.liveRevisionId ||
      current.item.scheduledAt
    )
      throw new Error('CMS NOT_PLAIN_DRAFT')
    return current
  }
  return {
    tools,
    async call(name, args = {}) {
      const definition = tools.find((tool) => tool.name === name)
      if (!definition) throw new Error('CMS DRAFT_TOOL_NOT_ALLOWED')
      if (
        !args ||
        typeof args !== 'object' ||
        Array.isArray(args) ||
        Object.keys(args).some(
          (key) => !Object.hasOwn(definition.inputSchema.properties, key),
        ) ||
        definition.inputSchema.required.some((key) => !Object.hasOwn(args, key))
      )
        throw new Error('CMS INVALID_TOOL_ARGUMENTS')
      for (const [key, value] of Object.entries(args)) {
        const schema = definition.inputSchema.properties[key]
        if (schema.type === 'string' && (typeof value !== 'string' || !value))
          throw new Error('CMS INVALID_TOOL_ARGUMENTS')
        if (
          schema.type === 'object' &&
          (!value || typeof value !== 'object' || Array.isArray(value))
        )
          throw new Error('CMS INVALID_TOOL_ARGUMENTS')
        if (schema.enum && !schema.enum.includes(value))
          throw new Error('CMS INVALID_DRAFT_COLLECTION')
      }
      const client = clients[args.collection ?? 'blog_articles']
      if (!client) throw new Error('CMS INVALID_DRAFT_COLLECTION')
      switch (name) {
        case 'drafts_list':
          return client.listArticles()
        case 'draft_get':
          return client.getArticle(args.id)
        case 'draft_create':
          if (
            typeof args.slug !== 'string' ||
            args.slug !== args.slug.normalize('NFC') ||
            !/^[\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC0-9]+(?:-[\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC0-9]+)*$/.test(
              args.slug,
            ) ||
            /[يك]/.test(args.slug)
          )
            throw new Error('CMS PERSIAN_SLUG_REQUIRED')
          return client.createDraft({ slug: args.slug, data: args.data })
        case 'draft_revise': {
          const current = ownDraft(await client.getArticle(args.id))
          if (current._rev !== args._rev)
            throw new Error('CMS REVISION_CHANGED')
          return client.reviseDraft(current, args.data)
        }
        case 'media_get':
          return client.getMedia(args.id)
        case 'media_upload':
          if (!args.path?.startsWith('/'))
            throw new Error('CMS ABSOLUTE_PATH_REQUIRED')
          return client.uploadImage(args.path, {
            alt: args.alt,
            caption: args.caption,
          })
        case 'draft_preview':
          ownDraft(await client.getArticle(args.id))
          return client.preview(args.id)
      }
    },
  }
}

async function serve(credentialFile) {
  const clients = {}
  for (const collection of collectionSchema.enum)
    clients[collection] = await cmsDraftClient(credentialFile, { collection })
  const operations = draftMcpOperations(clients)
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
  for await (const line of input) {
    let request
    try {
      request = JSON.parse(line)
      if (request.id === undefined) continue
      let result
      switch (request.method) {
        case 'initialize':
          await clients.blog_articles.connect()
          result = {
            protocolVersion: request.params?.protocolVersion ?? '2025-03-26',
            capabilities: { tools: {} },
            serverInfo: { name: 'saluna-production-drafts', version: '1.0.0' },
            instructions:
              'Production Saluna CMS. Draft-only: create/revise your own unscheduled drafts in blog_articles or product_guides. Never publishes. Read docs/agents/public-content.md before writing; use Persian slugs and titles up to 50 characters. Read overlap first. Call draft_get before draft_revise and pass its _rev. Keep previews private. Media uploads require user-authorized images. Human publication stays in EmDash admin.',
          }
          break
        case 'tools/list':
          result = { tools }
          break
        case 'tools/call':
          try {
            const value = await operations.call(
              request.params?.name,
              request.params?.arguments,
            )
            result = {
              content: [{ type: 'text', text: JSON.stringify(value) }],
            }
          } catch (error) {
            result = {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: error.message?.startsWith('CMS ')
                    ? error.message
                    : 'CMS DRAFT_OPERATION_FAILED',
                },
              ],
            }
          }
          break
        case 'ping':
          result = {}
          break
        default:
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32601, message: 'Method not found' },
            }) + '\n',
          )
          continue
      }
      process.stdout.write(
        JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n',
      )
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request?.id ?? null,
          error: { code: -32603, message: 'CMS MCP_REQUEST_FAILED' },
        }) + '\n',
      )
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  serve(process.argv[2]).catch(() => {
    process.stderr.write('CMS MCP_STARTUP_FAILED\n')
    process.exitCode = 1
  })
