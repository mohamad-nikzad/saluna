// Astro's static handler runs before page middleware. Keep canonical redirects
// for the rest of the site here; blog variants need the CMS's published state.
process.env.ASTRO_NODE_AUTOSTART = 'disabled'
const { handler, startServer } = await import('./dist/server/entry.mjs')

const {
  server: { server },
} = startServer()
server.removeAllListeners('request')
server.on('request', (request, response) => {
  let url
  try {
    url = new URL(request.url, 'http://localhost')
  } catch {
    return handler(request, response)
  }
  const { pathname } = url
  if (
    pathname.length > 1 &&
    pathname.endsWith('/') &&
    pathname !== '/blog/' &&
    pathname !== '/guides/' &&
    !pathname.startsWith('/guides/') &&
    !pathname.startsWith('/blog/') &&
    !pathname.startsWith('/_emdash/')
  ) {
    response.writeHead(301, {
      Location: pathname.replace(/\/+$/, '') + url.search,
    })
    response.end()
    return
  }
  handler(request, response)
})
