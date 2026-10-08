import assert from 'node:assert/strict'
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { createServer } from 'vite'

// Real manager components, with demonstrative data at their external HTTP
// boundary. No Saluna auth/database or shared environment file is used.
const repository = resolve(new URL('..', import.meta.url).pathname)
const output = resolve(process.argv[2] || 'guide-captures')
const app = resolve(repository, 'apps/pwa')
for (const name of [
  '.env',
  '.env.local',
  '.env.guide-fixture',
  '.env.guide-fixture.local',
]) {
  const present = await stat(resolve(app, name)).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  assert(!present, 'Capture in a checkout without PWA environment files')
}
await mkdir(output, { recursive: true })
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:3306'
process.env.VITE_WEB_URL = 'http://localhost:3301'
process.env.VITE_DEV_HTTPS = '0'
process.env.API_PORT = '3306'
process.chdir(app)
const server = await createServer({
  root: app,
  mode: 'guide-fixture',
  server: {
    host: '127.0.0.1',
    port: 3304,
    strictPort: true,
    fs: {
      allow: [repository, await realpath(resolve(repository, 'node_modules'))],
    },
  },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
  })
  const clients = []
  const unexpected = []
  const requested = []
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (
      url.origin === 'http://127.0.0.1:3304' &&
      !url.pathname.startsWith('/api/')
    )
      return route.continue()
    if (url.origin !== 'http://127.0.0.1:3306') {
      unexpected.push(url.origin + url.pathname)
      return route.abort()
    }
    requested.push(request.method() + ' ' + url.pathname)
    let data
    if (url.pathname === '/api/v1/auth/me')
      data = {
        status: 'ready',
        user: {
          id: 'demo-manager',
          salonId: 'demo-salon',
          name: 'مدیر نمونه',
          role: 'manager',
          color: '#7a2a40',
          phone: '09120000000',
          createdAt: '2026-10-08T00:00:00Z',
          needsOnboarding: false,
        },
      }
    else if (url.pathname === '/api/v1/clients' && request.method() === 'GET')
      data = { clients }
    else if (
      url.pathname === '/api/v1/clients' &&
      request.method() === 'POST'
    ) {
      const values = request.postDataJSON()
      assert.equal(values.name, 'مشتری نمونه')
      assert.equal(values.phone, '09120000001')
      const client = {
        ...values,
        id: 'demo-client',
        isPlaceholder: false,
        tags: [],
        createdAt: '2026-10-08T00:00:00Z',
      }
      clients.push(client)
      data = { client }
    } else if (url.pathname === '/api/v1/retention') data = { items: [] }
    else if (url.pathname === '/api/v1/appointment-requests')
      data = { requests: [] }
    else if (url.pathname === '/api/v1/support-tickets/summary')
      data = { unreadCount: 0 }
    else {
      unexpected.push(request.method() + ' ' + url.pathname)
      return route.abort()
    }
    return route.fulfill({ json: data })
  })
  await page.goto('http://127.0.0.1:3304/clients')
  await expect(
    page.getByRole('heading', { name: 'مشتریان', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /مشتری جدید/ })).toBeVisible()
  const debug = page.getByRole('button', {
    name: 'Open TanStack Devtools',
    exact: true,
  })
  if (await debug.count())
    await debug.evaluate((button) => {
      button.style.visibility = 'hidden'
    })
  const screenshot = (name) =>
    page.screenshot({
      path: resolve(output, name),
      animations: 'disabled',
      style:
        'button[aria-label="Open TanStack Devtools"] { visibility: hidden; }',
    })
  await screenshot('clients-screen.png')
  await page.getByRole('button', { name: /مشتری جدید/ }).click()
  await page.locator('#client-name').fill('مشتری نمونه')
  await page.locator('#client-phone').fill('09120000001')
  await page.getByRole('heading', { name: 'مشتری جدید', exact: true }).click()
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'افزودن مشتری', exact: true }),
  ).toBeEnabled()
  await screenshot('client-form.png')
  await page.getByRole('button', { name: 'افزودن مشتری', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'مشتری جدید', exact: true }),
  ).toBeHidden()
  await expect(page.getByText('مشتری نمونه', { exact: true })).toBeVisible()
  await expect(
    page.getByText('عملیات با موفقیت انجام شد', { exact: true }),
  ).toBeHidden()
  await screenshot('client-saved.png')
  await page.getByPlaceholder('جستجوی نام یا شماره…').fill('مشتری نمونه')
  await expect(page.getByText('مشتری نمونه', { exact: true })).toBeVisible()
  assert.deepEqual(
    unexpected,
    [],
    'Fixture must handle only its declared API origin and routes',
  )
  await writeFile(
    resolve(output, 'capture-evidence.json'),
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        source:
          'Actual current manager UI; browser-network demo responses, no operational database',
        apiOrigin: 'http://127.0.0.1:3306',
        requested,
        screenshots: [
          'clients-screen.png',
          'client-form.png',
          'client-saved.png',
        ],
        createAndSearch: 'passed',
      },
      null,
      2,
    ),
  )
  console.log('PASS isolated manager Client creation and screenshots')
} finally {
  await browser?.close()
  await server.close()
}
