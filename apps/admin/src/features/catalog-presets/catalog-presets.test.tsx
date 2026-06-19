import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAdminRoute } from '#/test/render-with-search-route'

const generated = vi.hoisted(() => ({
  listPresets: vi.fn(),
  createPreset: vi.fn(),
  updatePreset: vi.fn(),
  authMe: vi.fn(),
}))

function mockAuthMe(options: { dataSource?: 'local' | 'live' } = {}) {
  generated.authMe.mockResolvedValue({
    user: {
      id: 'admin-user-id',
      userId: 'admin-user-id',
      name: 'Platform Owner',
      email: 'owner@saluna.test',
      phoneNumber: '+989120000000',
      username: 'owner',
      role: 'platform_owner',
      active: true,
    },
    runtime: { dataSource: options.dataSource ?? 'local' },
  })
}

vi.mock('@repo/api-client/query', () => ({
  getApiV1AdminAuthMeOptions: () => ({
    queryKey: ['admin-auth-me-test'],
    queryFn: () => generated.authMe(),
  }),
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

function renderCatalogPresets(
  options: { dataSource?: 'local' | 'live' } = {},
) {
  mockAuthMe(options)
  return renderAdminRoute('/catalog-presets')
}

const presetId = '22222222-2222-4222-8222-222222222222'

describe('catalog presets feature', () => {
  beforeEach(() => {
    generated.listPresets.mockReset()
    generated.createPreset.mockReset()
    generated.updatePreset.mockReset()
    mockAuthMe()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders a searchable paginated Catalog Presets table from generated query options', async () => {
    generated.listPresets.mockResolvedValue({
      items: [
        {
          id: presetId,
          name: 'Starter services',
          slug: 'starter-services',
          isActive: true,
          sortOrder: 1,
          tree: [
            {
              name: 'Hair',
              families: [
                {
                  name: 'Cut',
                  variants: [{ name: 'Basic cut', duration: 30, price: 10 }],
                },
              ],
            },
          ],
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    })

    await renderCatalogPresets()

    expect(await screen.findByText('Starter services')).toBeTruthy()
    expect(screen.getByText('starter-services')).toBeTruthy()
    expect(screen.getByText('1 دسته')).toBeTruthy()
    expect(screen.getByText('1 خانواده')).toBeTruthy()
    expect(screen.getByText('1 نسخه سرویس')).toBeTruthy()
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

    await renderCatalogPresets()

    fireEvent.click(await screen.findByRole('button', { name: /الگوی جدید/ }))
    fireEvent.change(screen.getByLabelText('شناسه'), {
      target: { value: 'hair-services' },
    })
    fireEvent.change(screen.getByLabelText('نام الگوی کاتالوگ'), {
      target: { value: 'Hair services' },
    })
    fireEvent.change(screen.getByLabelText('دسته'), {
      target: { value: 'Hair' },
    })
    fireEvent.change(screen.getByLabelText('خانواده'), {
      target: { value: 'Color' },
    })
    fireEvent.change(screen.getByLabelText('نسخه سرویس'), {
      target: { value: 'Root color' },
    })
    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'Add starter service template' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ذخیره الگوی کاتالوگ/ }))

    await waitFor(() => {
      expect(generated.createPreset).toHaveBeenCalled()
    })
    expect(generated.createPreset.mock.calls[0]?.[0]).toEqual({
      body: {
        slug: 'hair-services',
        name: 'Hair services',
        description: null,
        tree: [
          {
            name: 'Hair',
            families: [
              {
                name: 'Color',
                variants: [
                  {
                    name: 'Root color',
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
        reason: 'Add starter service template',
      },
    })
  })

  it('updates a live-data CatalogPreset after showing production warning copy', async () => {
    generated.listPresets.mockResolvedValue({
      items: [
        {
          id: presetId,
          name: 'Starter services',
          slug: 'starter-services',
          isActive: true,
          sortOrder: 1,
          tree: [
            {
              name: 'Hair',
              families: [
                {
                  name: 'Cut',
                  variants: [
                    {
                      name: 'Basic cut',
                      duration: 30,
                      price: 10,
                      color: 'rose',
                    },
                    {
                      name: 'Layered cut',
                      duration: 45,
                      price: 20,
                      color: 'teal',
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

    await renderCatalogPresets({ dataSource: 'live' })

    fireEvent.click(await screen.findByRole('button', { name: /ویرایش/ }))
    expect(screen.getByText(/داده LIVE تولید/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('دلیل'), {
      target: { value: 'Fix service variant name' },
    })
    fireEvent.change(screen.getByLabelText('تأیید داده LIVE'), {
      target: { value: 'LIVE' },
    })
    fireEvent.click(screen.getByRole('button', { name: /ذخیره الگوی کاتالوگ/ }))

    await waitFor(() => {
      expect(generated.updatePreset).toHaveBeenCalled()
    })
    expect(generated.updatePreset.mock.calls[0]?.[0]).toMatchObject({
      path: { id: presetId },
      body: {
        slug: 'starter-services',
        name: 'Starter services',
        reason: 'Fix service variant name',
        liveConfirmation: 'LIVE',
      },
    })
  })

  it('requires confirmation before removing nested tree items', async () => {
    generated.listPresets.mockResolvedValue({
      items: [
        {
          id: presetId,
          name: 'Starter services',
          slug: 'starter-services',
          isActive: true,
          sortOrder: 1,
          tree: [
            {
              name: 'Hair',
              families: [
                {
                  name: 'Cut',
                  variants: [
                    {
                      name: 'Basic cut',
                      duration: 30,
                      price: 10,
                      color: 'rose',
                    },
                    {
                      name: 'Layered cut',
                      duration: 45,
                      price: 20,
                      color: 'teal',
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

    await renderCatalogPresets()

    fireEvent.click(await screen.findByRole('button', { name: /ویرایش/ }))
    expect(screen.getAllByLabelText('نسخه سرویس')).toHaveLength(2)

    fireEvent.click(screen.getAllByLabelText('حذف نسخه سرویس')[0]!)
    expect(
      screen.getByText('این نسخه سرویس حذف شود؟'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }))
    expect(screen.getAllByLabelText('نسخه سرویس')).toHaveLength(2)

    fireEvent.click(screen.getAllByLabelText('حذف نسخه سرویس')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }))
    expect(screen.getAllByLabelText('نسخه سرویس')).toHaveLength(1)
  })
})
