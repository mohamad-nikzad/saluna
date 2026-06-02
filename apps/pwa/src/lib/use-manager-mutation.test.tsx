// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DataClient } from '@repo/data-client'

import { useManagerMutation } from './use-manager-mutation'

const processPending = vi.fn(async () => {})
const fakeClient = { sync: { processPending } } as unknown as DataClient

vi.mock('#/lib/manager-data-client', () => ({
  useRequiredManagerDataClient: () => fakeClient,
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  processPending.mockClear()
})

describe('useManagerMutation', () => {
  it('passes the data client to the mutation and flushes pending writes on success', async () => {
    const mutationFn = vi.fn(
      async (_dc: DataClient, value: number) => value * 2,
    )

    const { result } = renderHook(() => useManagerMutation(mutationFn), {
      wrapper,
    })

    const returned = await result.current.mutateAsync(21)

    expect(returned).toBe(42)
    expect(mutationFn).toHaveBeenCalledWith(fakeClient, 21)
    expect(processPending).toHaveBeenCalledTimes(1)
  })

  it('does not flush pending writes when the mutation fails', async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error('boom')
    })

    const { result } = renderHook(() => useManagerMutation(mutationFn), {
      wrapper,
    })

    await expect(result.current.mutateAsync()).rejects.toThrow('boom')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(processPending).not.toHaveBeenCalled()
  })
})
