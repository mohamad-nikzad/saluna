import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { AdminAuthProvider } from '#/context/admin-auth-provider'

import { CatalogPresetsScreen } from './index'

const generated = vi.hoisted(() => ({
  listPresets: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
}))

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminCatalogPresetsQueryKey: () => [{ _id: 'catalog-presets' }],
  getApiV1AdminCatalogPresetsOptions: (options: unknown) => ({
    queryKey: ['catalog-presets', options],
    queryFn: () => generated.listPresets(options),
  }),
  postApiV1AdminCatalogPresetsMutation: () => ({
    mutationFn: generated.createPreset,
  }),
  patchApiV1AdminCatalogPresetsByIdMutation: () => ({
    mutationFn: generated.updatePreset,
  }),
}))

function renderWithProviders(
  children: ReactNode,
  options: { dataSource?: 'local' | 'live' } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider
        me={{
          id: 'admin-user-id',
          userId: 'admin-user-id',
          name: 'Platform Owner',
          email: 'owner@saluna.test',
          phoneNumber: '+989120000000',
          username: 'owner',
          role: 'platform_owner',
          active: true,
        }}
        runtime={{ dataSource: options.dataSource ?? 'local' }}
      >
        {children}
      </AdminAuthProvider>
    </QueryClientProvider>,
  )
}

const presetId = '22222222-2222-4222-8222-222222222222'

describe('catalog presets feature', () => {
  beforeEach(() => {
    generated.listPresets.mockReset()
    generated.createPreset.mockReset()
    generated.updatePreset.mockReset()
    window.history.replaceState(null, '', '/catalog-presets')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a searchable paginated Catalog Presets table from generated query options', async () => {
    generated.listPresets.mockResolvedValue({
      items: [
        {
          id: presetId,
          name: 'قالب خدمات پایه',
          slug: 'starter-services',
          isActive: true,
          sortOrder: 1,
          tree: [
            {
              name: 'مو',
              families: [
                {
                  name: 'کوتاهی',
                  variants: [{ name: 'کوتاهی ساده', duration: 30, price: 10 }],
                },
              ],
            },
          ],
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })

    renderWithProviders(<CatalogPresetsScreen />)

    expect(await screen.findByText('قالب خدمات پایه')).toBeTruthy()
    expect(screen.getByText('starter-services')).toBeTruthy()
    expect(screen.getByText('1 category')).toBeTruthy()
    expect(screen.getByText('1 family')).toBeTruthy()
    expect(screen.getByText('1 service variant')).toBeTruthy()
    expect(generated.listPresets).toHaveBeenCalledWith({
      query: { page: 1, pageSize: 20, search: undefined },
    })
  })

  it('creates a CatalogPreset with category, family, service variant, and reason', async () => {
    generated.listPresets.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    })
    generated.createPreset.mockResolvedValue({ preset: { id: presetId } })

    renderWithProviders(<CatalogPresetsScreen />)

    fireEvent.click(await screen.findByRole('button', { name: /جدید/ }))
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'hair-services' },
    })
    fireEvent.change(screen.getByLabelText('نام Catalog Preset'), {
      target: { value: 'قالب خدمات مو' },
    })
    fireEvent.change(screen.getByLabelText('category'), {
      target: { value: 'مو' },
    })
    fireEvent.change(screen.getByLabelText('family'), {
      target: { value: 'رنگ' },
    })
    fireEvent.change(screen.getByLabelText('service variant'), {
      target: { value: 'رنگ ریشه' },
    })
    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'افزودن قالب خدمات پایه' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ذخیره/ }))

    await waitFor(() => {
      expect(generated.createPreset).toHaveBeenCalled()
    })
    expect(generated.createPreset.mock.calls[0]?.[0]).toEqual({
      body: {
        slug: 'hair-services',
        name: 'قالب خدمات مو',
        description: null,
        tree: [
          {
            name: 'مو',
            families: [
              {
                name: 'رنگ',
                variants: [
                  {
                    name: 'رنگ ریشه',
                    duration: 30,
                    price: 0,
                    color: 'teal',
                    description: null,
                  },
                ],
              },
            ],
          },
        ],
        sortOrder: 0,
        isActive: true,
        reason: 'افزودن قالب خدمات پایه',
      },
    })
  })

  it('updates a live-data CatalogPreset after showing production warning copy', async () => {
    generated.listPresets.mockResolvedValue({
      items: [
        {
          id: presetId,
          name: 'قالب خدمات پایه',
          slug: 'starter-services',
          isActive: true,
          sortOrder: 1,
          tree: [
            {
              name: 'مو',
              families: [
                {
                  name: 'کوتاهی',
                  variants: [
                    {
                      name: 'کوتاهی ساده',
                      duration: 30,
                      price: 10,
                      color: 'rose',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })
    generated.updatePreset.mockResolvedValue({ preset: { id: presetId } })

    renderWithProviders(<CatalogPresetsScreen />, { dataSource: 'live' })

    fireEvent.click(await screen.findByRole('button', { name: /ویرایش/ }))
    expect(screen.getByText(/روی داده زنده تولید اعمال می‌شود/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'اصلاح نام service variant' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ذخیره/ }))

    await waitFor(() => {
      expect(generated.updatePreset).toHaveBeenCalled()
    })
    expect(generated.updatePreset.mock.calls[0]?.[0]).toMatchObject({
      path: { id: presetId },
      body: {
        slug: 'starter-services',
        name: 'قالب خدمات پایه',
        reason: 'اصلاح نام service variant',
      },
    })
  })
})
