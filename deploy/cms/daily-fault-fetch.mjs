// Test-only transparent transport to a real-CMS HTTP fault proxy.
const nativeFetch = globalThis.fetch
globalThis.fetch = (input, options) => {
  const url = new URL(input)
  return nativeFetch(
    url.origin === 'http://localhost:3301'
      ? `${process.env.CMS_TEST_PROXY_URL}${url.pathname}${url.search}`
      : input,
    options,
  )
}
