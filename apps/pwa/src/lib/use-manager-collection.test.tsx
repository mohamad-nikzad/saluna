// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DataClient } from '@repo/data-client'

import { useManagerCollection } from './use-manager-collection'

const queryKey = ['manager', 'staff'] as const
const list = vi.fn(async () => [{ id: '1' }])
const unsubscribe = vi.fn()
let pushSubscribeUpdate: ((items: { id: string }[]) => void) | null = null
const subscribe = vi.fn((listener: (items: { id: string }[]) => void) => {
  pushSubscribeUpdate = listener
  return unsubscribe
})

const fakeClient = {
  staff: { list, subscribe },
} as unknown as DataClient

const useManagerDataClient = vi.fn(() => fakeClient as DataClient | null)

vi.mock('#/lib/manager-data-client', () => ({
  useManagerDataClient: () => useManagerDataClient(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  list.mockClear()
  subscribe.mockClear()
  unsubscribe.mockClear()
  pushSubscribeUpdate = null
  useManagerDataClient.mockReturnValue(fakeClient)
})

describe('useManagerCollection', () => {
  it('fetches via list when the data client is present', async () => {
    const { result } = renderHook(
      () =>
        useManagerCollection(
          queryKey,
          (dc) => dc.staff.list() as Promise<{ id: string }[]>,
        ),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(list).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual([{ id: '1' }])
  })

  it('does not fetch when the data client is absent', () => {
    useManagerDataClient.mockReturnValue(null)

    const { result } = renderHook(
      () =>
        useManagerCollection(
          queryKey,
          (dc) => dc.staff.list() as Promise<{ id: string }[]>,
        ),
      { wrapper },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(list).not.toHaveBeenCalled()
  })

  it('pushes subscribe updates into the query cache', async () => {
    const subscribeBridge = (
      dc: DataClient,
      sync: (update: { id: string }[]) => void,
    ) => dc.staff.subscribe(sync)

    const { result } = renderHook(
      () =>
        useManagerCollection(
          queryKey,
          (dc) => dc.staff.list() as Promise<{ id: string }[]>,
          subscribeBridge,
        ),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: '1' }])

    pushSubscribeUpdate!([{ id: 'synced' }])

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 'synced' }]),
    )
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes when the hook unmounts', async () => {
    const subscribeBridge = (
      dc: DataClient,
      sync: (update: { id: string }[]) => void,
    ) => dc.staff.subscribe(sync)

    const { unmount } = renderHook(
      () =>
        useManagerCollection(
          queryKey,
          (dc) => dc.staff.list() as Promise<{ id: string }[]>,
          subscribeBridge,
        ),
      { wrapper },
    )

    await waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1))

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
