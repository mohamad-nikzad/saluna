// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  getApiV1ServicesQueryKey,
  servicesListQueryOptions,
} from '#/lib/services-queries'

const getApiV1Services = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Services: (...args: unknown[]) => getApiV1Services(...args),
  getApiV1ServiceCategories: vi.fn(),
  getApiV1ServiceFamilies: vi.fn(),
  getApiV1ServiceAddons: vi.fn(),
  getApiV1ServicesByIdAddons: vi.fn(),
  getApiV1ServicesByIdComboComponents: vi.fn(),
  getApiV1CatalogPresets: vi.fn(),
}))

beforeEach(() => {
  getApiV1Services.mockReset()
})

describe('services-queries', () => {
  it('exposes generated services list query keys', () => {
    expect(getApiV1ServicesQueryKey()[0]._id).toBe('getApiV1Services')
  })

  it('selects services from the generated list response', async () => {
    getApiV1Services.mockResolvedValue({
      data: { services: [{ id: 'svc-1', name: 'رنگ مو' }] },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(servicesListQueryOptions())

    expect(data).toEqual([{ id: 'svc-1', name: 'رنگ مو' }])
  })

})
