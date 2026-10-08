import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import {
  cmsOrigin,
  readPrivateJson,
  writePrivateJson,
} from '../../scripts/cms-draft-client.mjs'

/** A retained technical passkey exercises native session permissions. It is
 * separate from the intended editor's unconsumed physical-passkey invitation. */
export async function technicalSession(
  statePath,
  role,
  origin = 'http://localhost:3301',
) {
  const base = cmsOrigin(origin)
  assert.equal(
    base,
    'http://localhost:3301',
    'Use only the retained isolated CMS',
  )
  assert(['author', 'editor', 'operator'].includes(role))
  const state = await readPrivateJson(statePath)
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })
  try {
    const page = await browser.newPage({ baseURL: base })
    await page.goto('/_emdash/api/setup/status')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      },
    )
    for (const credential of state[role])
      await cdp.send('WebAuthn.addCredential', { authenticatorId, credential })
    const api = async (
      path,
      body,
      method = body === undefined ? 'GET' : 'POST',
    ) => {
      const response = await page.request.fetch(`${base}/_emdash/api/${path}`, {
        method,
        headers: { 'X-EmDash-Request': '1' },
        ...(body === undefined ? {} : { data: body }),
      })
      assert(
        response.ok(),
        `Native ${method} ${path.split('?')[0]} returned ${response.status()}`,
      )
      const json = await response.json()
      assert(json.success, 'Native CMS request failed')
      return json.data
    }
    const registration = await api('auth/passkey/options', {})
    const credential = await page.evaluate(
      async (options) =>
        (
          await navigator.credentials.get({
            publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
          })
        ).toJSON(),
      registration.options,
    )
    await api('auth/passkey/verify', { credential })
    const identity = await api('auth/me')
    assert(
      role === 'operator'
        ? identity.role >= 50
        : identity.role === { author: 30, editor: 40 }[role],
    )
    return {
      page,
      api,
      close: async () => {
        state[role] = (
          await cdp.send('WebAuthn.getCredentials', { authenticatorId })
        ).credentials
        await writePrivateJson(statePath, state)
        await browser.close()
      },
    }
  } catch (error) {
    await browser.close()
    throw error
  }
}
