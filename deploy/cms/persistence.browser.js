// Run twice in the SAME Playwright CLI browser session against a disposable
// production-image instance. Replace its container between the two runs.
async function rehearsal(page) {
  const existing = await page.evaluate(() =>
    localStorage.getItem('saluna-cms-persistence'),
  )
  if (!existing) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.disable')
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
  const result = await page.evaluate(async (existing) => {
    async function api(path, body) {
      const response = await fetch(`/_emdash/api/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-EmDash-Request': '1',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`${path} returned ${response.status} instead of JSON`)
      }
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(
          `${path} failed: ${response.status} ${JSON.stringify(json)}`,
        )
      }
      return json.data
    }
    if (!existing) {
      const status = await api('setup/status')
      if (!status.needsSetup)
        throw new Error('Use a fresh disposable CMS database')
      await api('setup', {
        title: 'Saluna persistence rehearsal',
        includeContent: false,
      })
      const registration = await api('setup/admin', {
        email: 'operator@example.test',
        name: 'Persistence operator',
      })
      const credential = await navigator.credentials.create({
        publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
          registration.options,
        ),
      })
      await api('setup/admin/verify', { credential: credential.toJSON() })
    }
    // Reauthenticate after replacement, including when Astro sessions were lost.
    const authentication = await api('auth/passkey/options', {})
    const credential = await navigator.credentials.get({
      publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
        authentication.options,
      ),
    })
    await api('auth/passkey/verify', { credential: credential.toJSON() })
    const operator = await api('auth/me')
    if (!operator.id) throw new Error('Authenticated operator is missing')
    let fixture = existing ? JSON.parse(existing) : null
    if (!fixture) {
      const title = 'BL-0092 Persian draft: آزمون ماندگاری'
      const entry = await api('content/posts', {
        status: 'draft',
        slug: 'bl-0092-persistence',
        data: { title },
      })
      const bytes = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
        ),
        (char) => char.charCodeAt(0),
      )
      const upload = await api('media/upload-url', {
        filename: 'persistence.png',
        contentType: 'image/png',
        size: bytes.length,
      })
      const response = await fetch(upload.uploadUrl, {
        method: upload.method,
        headers: upload.headers,
        body: bytes,
      })
      if (!response.ok)
        throw new Error(`Image upload failed: ${response.status}`)
      const media = await api(`media/${upload.mediaId}/confirm`, {})
      fixture = {
        entryId: entry.item.id,
        title,
        mediaId: upload.mediaId,
        mediaUrl: media.item.url,
        image: btoa(String.fromCharCode(...bytes)),
      }
      if (!fixture.entryId || !fixture.mediaUrl)
        throw new Error('Fixture IDs are missing')
      localStorage.setItem('saluna-cms-persistence', JSON.stringify(fixture))
    }
    const saved = await api(`content/posts/${fixture.entryId}`)
    const entry = saved.item
    if (
      entry.data.title !== fixture.title ||
      entry.status !== 'draft' ||
      entry.authorId !== operator.id
    ) {
      throw new Error('Saved draft changed or disappeared')
    }
    const media = await api(`media/${fixture.mediaId}`)
    if (media.item?.id !== fixture.mediaId || media.item.status !== 'ready') {
      throw new Error('Media metadata is missing')
    }
    const image = await fetch(fixture.mediaUrl)
    const bytes = new Uint8Array(await image.arrayBuffer())
    if (!image.ok || btoa(String.fromCharCode(...bytes)) !== fixture.image) {
      throw new Error('Uploaded image changed or disappeared')
    }
    return {
      phase: existing ? 'after replacement' : 'before replacement',
      ...fixture,
    }
  }, existing)
  await page.goto(new URL('/_emdash/admin', page.url()).href)
  await page.locator('a[href="/_emdash/admin/content/posts"]').first().waitFor()
  const welcome = page.getByRole('button', { name: 'Get Started', exact: true })
  if (!existing) await welcome.waitFor()
  if (await welcome.isVisible()) await welcome.click()
  await page.getByRole('link', { name: 'Posts', exact: true }).first().click()
  await page.getByText(result.title, { exact: true }).first().waitFor()
  return result
}
