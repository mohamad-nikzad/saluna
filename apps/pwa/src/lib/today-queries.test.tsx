// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import { getApiV1TodayQueryKey, todayQueryOptions } from '#/lib/today-queries'

const getApiV1Today = vi.fn()

vi.mock('@repo/api-client/sdk', () => ({
  getApiV1Today: (...args: unknown[]) => getApiV1Today(...args),
}))

beforeEach(() => {
  getApiV1Today.mockReset()
})

describe('today-queries', () => {
  it('exposes generated today query keys with date', () => {
    expect(
      getApiV1TodayQueryKey({ query: { date: '2026-06-07' } })[0]._id,
    ).toBe('getApiV1Today')
  })

  it('maps today data from the generated response', async () => {
    getApiV1Today.mockResolvedValue({
      data: {
        date: '2026-06-07',
        counts: {
          scheduled: 1,
          confirmed: 0,
          completed: 0,
          cancelled: 0,
          'no-show': 0,
        },
        appointments: [],
        attentionItems: [],
        staffLoad: [],
        openSlots: [],
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const data = await queryClient.fetchQuery(todayQueryOptions('2026-06-07'))

    expect(data.date).toBe('2026-06-07')
    expect(getApiV1Today).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { date: '2026-06-07' },
      }),
    )
  })
})
