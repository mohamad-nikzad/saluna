// @vitest-environment jsdom
import { createElement, Suspense } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { brand } from '@repo/brand'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({ data: undefined, isPending: false }),
}))
vi.mock('#/lib/auth', () => ({
  useAuth: () => ({
    user: {
      role: 'staff',
      name: 'تست',
      phone: '09123456789',
      salonId: 'salon',
    },
  }),
}))
vi.mock('#/components/staff/staff-salon-switcher', () => ({
  StaffSalonSwitcher: () => null,
}))
vi.mock('#/components/support/support-settings-row', () => ({
  SupportSettingsRow: () => null,
}))

import { ThemeProvider } from '#/lib/theme'
import { Route } from './settings'

let media: EventTarget & { matches: boolean }
let client: QueryClient

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    clear: () => storage.clear(),
  })
  document.documentElement.classList.remove('light', 'dark')
  media = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('matchMedia', () => media)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  cleanup()
  client.clear()
  window.localStorage.clear()
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.style.removeProperty('color-scheme')
  vi.unstubAllGlobals()
})

async function renderSettings() {
  const component = Route.options.component
  if (!component) throw new Error('Missing settings page')
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <Suspense fallback={null}>{createElement(component)}</Suspense>
        </ThemeProvider>
      </QueryClientProvider>,
    )
  })
  await screen.findByRole('group', { name: 'پوسته' }, { timeout: 10_000 })
}

const labels = { system: 'سیستم', light: 'روشن', dark: 'تاریک' } as const

function choice(theme: keyof typeof labels) {
  return screen.getByRole('radio', { name: labels[theme] })
}

function expectTheme(theme: keyof typeof labels, dark: boolean) {
  for (const value of ['system', 'light', 'dark'] as const) {
    expect(choice(value).getAttribute('aria-checked')).toBe(
      String(value === theme),
    )
  }
  expect(document.documentElement.classList.contains('dark')).toBe(dark)
  expect(document.documentElement.style.colorScheme).toBe(
    dark ? 'dark' : 'light',
  )
}

it.each([null, 'system', 'dark', 'light'] as const)(
  'shows the saved theme or defaults to system with preference %s',
  async (stored) => {
    if (stored) window.localStorage.setItem(brand.storage.theme, stored)
    await renderSettings()
    expectTheme(stored ?? 'system', stored !== 'light')

    for (const value of ['light', 'dark', 'system'] as const) {
      fireEvent.click(choice(value))
      expectTheme(value, value !== 'light')
      expect(window.localStorage.getItem(brand.storage.theme)).toBe(value)
    }

    // Clicking the selected choice must not leave the theme unselected.
    fireEvent.click(choice('system'))
    expectTheme('system', true)
  },
)

it('follows system changes, supports an override, and can return to system', async () => {
  media.matches = false
  await renderSettings()
  expectTheme('system', false)

  act(() => {
    media.matches = true
    media.dispatchEvent(new Event('change'))
  })
  expectTheme('system', true)

  fireEvent.click(choice('light'))
  act(() => media.dispatchEvent(new Event('change')))
  expectTheme('light', false)

  fireEvent.click(choice('system'))
  expectTheme('system', true)
  act(() => {
    media.matches = false
    media.dispatchEvent(new Event('change'))
  })
  expectTheme('system', false)
})
