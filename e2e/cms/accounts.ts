import { expect, type Browser, type Page } from '@playwright/test'

export async function cms(
  page: Page,
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
) {
  const response = await page.request.fetch(`/_emdash/api/${path}`, {
    method,
    headers: { 'X-EmDash-Request': '1' },
    ...(body === undefined ? {} : { data: body }),
  })
  const json = await response.json()
  expect(
    response.ok(),
    `${method} ${path} returned ${response.status()}: ${json.error?.code ?? ''} ${json.error?.message ?? ''}`,
  ).toBe(true)
  expect(json.success).toBe(true)
  return json.data
}

async function passkey(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

export async function operatorAccount(browser: Browser) {
  const page = await (await browser.newContext()).newPage()
  page.setDefaultTimeout(15_000)
  await page.goto('/_emdash/api/setup/status')
  await passkey(page)
  await page.evaluate(async () => {
    async function api(path: string, body: unknown) {
      const response = await fetch(`/_emdash/api/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-EmDash-Request': '1',
        },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok || !json.success)
        throw new Error(`${path}: ${JSON.stringify(json)}`)
      return json.data
    }
    await api('setup', { title: 'Saluna CMS test', includeContent: false })
    const registration = await api('setup/admin', {
      email: 'operator@example.test',
      name: 'CMS operator',
    })
    const credential = (await navigator.credentials.create({
      publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
        registration.options,
      ),
    })) as PublicKeyCredential
    await api('setup/admin/verify', { credential: credential.toJSON() })
    const authentication = await api('auth/passkey/options', {})
    const signIn = (await navigator.credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
        authentication.options,
      ),
    })) as PublicKeyCredential
    await api('auth/passkey/verify', { credential: signIn.toJSON() })
  })
  return page
}

export async function invitedAccount(
  browser: Browser,
  operator: Page,
  name: string,
  role: number,
) {
  const invitation = await cms(operator, 'auth/invite', {
    email: `${name}@example.test`,
    role,
  })
  const mail = invitation.inviteUrl
    ? null
    : (await cms(operator, 'dev/emails')).items[0]
  const inviteUrl =
    invitation.inviteUrl ?? mail.message.text.match(/https?:\/\/\S+/)?.[0]
  const token = new URL(inviteUrl).searchParams.get('token')!
  const page = await (await browser.newContext()).newPage()
  page.setDefaultTimeout(15_000)
  await page.goto('/_emdash/api/setup/status')
  await passkey(page)
  await page.evaluate(
    async ({ token, name }) => {
      async function api(path: string, body: unknown) {
        const response = await fetch(`/_emdash/api/${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-EmDash-Request': '1',
          },
          body: JSON.stringify(body),
        })
        const json = await response.json()
        if (!response.ok || !json.success)
          throw new Error(`Invite failed: ${path}`)
        return json.data
      }
      const registration = await api('auth/invite/register-options', {
        token,
        name,
      })
      const credential = (await navigator.credentials.create({
        publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
          registration.options,
        ),
      })) as PublicKeyCredential
      await api('auth/invite/complete', {
        token,
        name,
        credential: credential.toJSON(),
      })
    },
    { token, name },
  )
  return page
}

export async function openAdmin(page: Page) {
  await page.goto('/_emdash/admin')
  await page
    .locator('a[href="/_emdash/admin/content/blog_articles"]')
    .first()
    .waitFor()
  const welcome = page.getByRole('button', { name: 'Get Started', exact: true })
  // Every fresh account receives the onboarding dialog once.
  await welcome.waitFor()
  await welcome.click()
}
