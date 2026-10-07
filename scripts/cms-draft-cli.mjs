#!/usr/bin/env node
// Credentials and returned draft/preview payloads stay in protected files.
import {
  cmsDraftClient,
  readPrivateJson,
  writePrivateJson,
} from './cms-draft-client.mjs'
import { resolve } from 'node:path'

const [action, credentialFile, requestFile, outputFile] = process.argv.slice(2)
try {
  if (
    ![
      'connect',
      'list',
      'read',
      'create',
      'revise',
      'upload',
      'media',
      'preview',
    ].includes(action) ||
    !credentialFile ||
    !requestFile ||
    !outputFile
  )
    throw new Error('CMS USAGE_action_credentials_request_output')
  if (
    resolve(outputFile) === resolve(credentialFile) ||
    resolve(outputFile) === resolve(requestFile)
  )
    throw new Error('CMS DISTINCT_OUTPUT_REQUIRED')
  const client = await cmsDraftClient(credentialFile)
  const request = await readPrivateJson(requestFile)
  const discovery = await client.connect()
  let result
  switch (action) {
    case 'connect':
      result = { tools: discovery.tools.map((tool) => tool.name) }
      break
    case 'list':
      result = { items: await client.listArticles() }
      break
    case 'read':
      result = await client.getArticle(request.id)
      break
    case 'create':
      result = await client.createDraft(request)
      break
    case 'revise': {
      const current = await client.getArticle(request.id)
      if (!request._rev || current._rev !== request._rev)
        throw new Error('CMS STALE_REVISION')
      result = await client.reviseDraft(current, request.data)
      break
    }
    case 'upload':
      result = await client.uploadImage(request.path, {
        alt: request.alt,
        caption: request.caption,
      })
      break
    case 'media':
      result = await client.getMedia(request.id)
      break
    case 'preview': {
      const current = await client.getArticle(request.id)
      if (
        current.item.status !== 'draft' ||
        current.item.liveRevisionId ||
        current.item.scheduledAt
      )
        throw new Error('CMS NOT_PLAIN_DRAFT')
      result = {
        ...(await client.preview(current.item.id)),
        item: current.item,
      }
      break
    }
  }
  await writePrivateJson(outputFile, result)
  console.log(`PASS CMS ${action}; result saved privately`)
} catch (error) {
  console.error(
    /^CMS [A-Za-z0-9_:-]+(?: [A-Za-z0-9_:-]+)?$/.test(error.message)
      ? error.message
      : `CMS ${error.code ?? 'CLIENT_ERROR'}`,
  )
  process.exitCode = 1
}
