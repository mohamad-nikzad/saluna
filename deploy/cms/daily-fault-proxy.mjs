import { createServer } from 'node:http'

// Faults only at the external HTTP boundary. Every saved mutation is real CMS.
export async function nativeFaultProxy() {
  let mode, created, afterCreate, uploaded, beforeUpdate
  const server = createServer(async (request, response) => {
    try {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const body = Buffer.concat(chunks)
      let rpc
      try {
        rpc = JSON.parse(body)
      } catch {
        /* Not an MCP request. */
      }
      const tool = rpc?.params?.name
      if (mode === 'connect-fail' && rpc?.method === 'initialize') {
        mode = undefined
        response.writeHead(503).end('Unavailable before any content write')
        return
      }
      if (mode === 'stale-update' && tool === 'content_update') {
        mode = undefined
        await beforeUpdate(rpc.params.arguments)
      }
      if (mode === 'read-after-upload' && uploaded && tool === 'media_get') {
        response.writeHead(503).end('Unavailable')
        return
      }
      if (mode === 'preview-fail' && request.url.endsWith('/preview-url')) {
        mode = undefined
        response.writeHead(503).end('Unavailable')
        return
      }
      if (mode === 'read-after-create' && created && tool === 'content_get') {
        response.writeHead(503).end('Unavailable')
        return
      }
      const result = await fetch(`http://localhost:3301${request.url}`, {
        method: request.method,
        headers: { ...request.headers, host: 'localhost:3301' },
        ...(body.length ? { body } : {}),
        signal: AbortSignal.timeout(15_000),
      })
      const bytes = Buffer.from(await result.arrayBuffer())
      if (tool === 'media_upload') uploaded = true
      if (
        (mode === 'lose-upload' && tool === 'media_upload') ||
        (mode === 'lose-update' && tool === 'content_update')
      ) {
        mode = undefined
        response.writeHead(503).end('Response lost after save')
        return
      }
      if (tool === 'content_create') {
        created = true
        if (mode === 'lose-create' || mode === 'edit-after-create') {
          const lost = mode === 'lose-create'
          mode = undefined
          const text = bytes.toString()
          const message = JSON.parse(
            text.startsWith('{')
              ? text
              : text
                  .split('\n')
                  .find((line) => line.startsWith('data:'))
                  .slice(5),
          )
          const saved = JSON.parse(
            message.result.content.find((part) => part.type === 'text').text,
          )
          if (afterCreate) await afterCreate(saved.item.id)
          if (lost) {
            response.writeHead(503).end('Response lost after save')
            return
          }
        }
      }
      response
        .writeHead(result.status, Object.fromEntries(result.headers))
        .end(bytes)
    } catch {
      response.writeHead(502).end('Fault rehearsal failed')
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    fault(value, after) {
      mode = value
      created = false
      uploaded = false
      afterCreate = after
      beforeUpdate = after
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
