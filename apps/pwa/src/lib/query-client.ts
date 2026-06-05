import { MutationCache, QueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import { DataClientHttpError } from '@repo/data-client'
import { toast } from '@repo/ui/use-toast'

export const DEFAULT_MUTATION_SUCCESS = 'عملیات با موفقیت انجام شد'
export const DEFAULT_MUTATION_ERROR = 'خطایی رخ داد. لطفاً دوباره تلاش کنید.'
export const HEAVY_QUERY_STALE_TIME_MS = 5 * 60 * 1000

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Skip all mutation toasts (success, error). */
      skipToast?: boolean
      skipSuccessToast?: boolean
      skipErrorToast?: boolean
      /** Single query key or list of keys to invalidate on settle. */
      invalidatesQuery?: QueryKey | QueryKey[]
      /** Custom success copy. `null` suppresses the success toast. */
      successMessage?: string | null
      /** Fallback when the error has no message. */
      errorMessage?: string
    }
  }
}

export function getMutationErrorMessage(
  error: unknown,
  fallback = DEFAULT_MUTATION_ERROR,
): string {
  if (error instanceof DataClientHttpError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function invalidateQueriesFromMeta(
  client: QueryClient,
  keys: QueryKey | QueryKey[] | undefined,
) {
  if (!keys) return

  const keyList: QueryKey[] =
    Array.isArray(keys) && keys.length > 0 && Array.isArray(keys[0])
      ? (keys as QueryKey[])
      : [keys as QueryKey]

  for (const queryKey of keyList) {
    void client.invalidateQueries({ queryKey })
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const meta = mutation.meta
      if (
        meta?.skipToast ||
        meta?.skipSuccessToast ||
        meta?.successMessage === null
      ) {
        return
      }
      toast({
        variant: 'success',
        title: meta?.successMessage ?? DEFAULT_MUTATION_SUCCESS,
      })
    },
    onError: (error, _variables, _context, mutation) => {
      const meta = mutation.meta
      if (meta?.skipToast || meta?.skipErrorToast) return
      toast({
        variant: 'destructive',
        title: getMutationErrorMessage(
          error,
          meta?.errorMessage ?? DEFAULT_MUTATION_ERROR,
        ),
      })
    },
    onSettled: (_data, _error, _variables, _context, mutation) => {
      invalidateQueriesFromMeta(queryClient, mutation.meta?.invalidatesQuery)
    },
  }),
})
