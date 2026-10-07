import assert from 'node:assert/strict'

/** Check editing and public reading. Passkey options consume a rate-limit slot,
 * so this is a deliberate deployment smoke check, not a frequent health probe.
 */
export async function checkCmsHealth(base) {
  const request = (path, options = {}) =>
    fetch(new URL(path, base), {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      ...options,
    })
  const landing = await request('/')
  assert.equal(landing.status, 200, 'Landing page must load')
  const setup = await request('/_emdash/api/setup/status')
  assert.equal(setup.status, 200, 'CMS database and migrations must respond')
  const status = await setup.json()
  assert.equal(status.success, true, 'CMS setup must respond successfully')
  assert.equal(
    status.data?.needsSetup,
    false,
    'CMS operator setup must be complete',
  )
  assert.equal(
    (await request('/blog')).status,
    200,
    'CMS public content must load',
  )

  const admin = await request('/_emdash/admin')
  assert.equal(admin.status, 200, 'CMS editor shell must load')
  const html = await admin.text()
  const assets = new Set(
    [
      ...html.matchAll(/(?:src|component-url|renderer-url)="([^"]+)"/g),
      ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
    ]
      .map((match) => new URL(match[1], base))
      .filter((url) => url.origin === new URL(base).origin)
      .map((url) => url.href),
  )
  assert.ok(assets.size >= 2, 'CMS editor must include its hydration assets')
  for (const asset of assets)
    assert.equal(
      (await request(asset)).status,
      200,
      'CMS editor asset must load',
    )

  const authentication = await request('/_emdash/api/auth/passkey/options', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-EmDash-Request': '1',
      Origin: new URL(base).origin,
    },
    body: '{}',
  })
  assert.equal(
    authentication.status,
    200,
    'CMS passkey login dependency must respond',
  )
  const json = await authentication.json()
  assert.equal(json.success, true, 'CMS passkey options must succeed')
  assert.ok(
    json.data?.options?.challenge,
    'CMS must generate a passkey challenge',
  )
  const rpId = json.data?.options?.rpId
  const hostname = new URL(base).hostname
  assert.ok(
    rpId && (hostname === rpId || hostname.endsWith(`.${rpId}`)),
    'CMS passkey origin must match',
  )
}
