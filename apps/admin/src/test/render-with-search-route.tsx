import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'

import type { RouterContext } from '#/router'
import { DirectionProvider } from '#/context/direction-provider'
import { SearchProvider } from '#/context/search-provider'
import { ThemeProvider } from '#/context/theme-provider'
import { routeTree } from '#/routeTree.gen'

type RenderAdminRouteOptions = {
  wrapper?: (children: ReactNode) => ReactNode
  queryClient?: QueryClient
}

type RenderAdminRouteResult = RenderResult & {
  router: ReturnType<typeof createRouter>
  history: ReturnType<typeof createMemoryHistory>
}

export async function renderAdminRoute(
  initialEntry: string,
  options: RenderAdminRouteOptions = {},
): Promise<RenderAdminRouteResult> {
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

  const history = createMemoryHistory({
    initialEntries: [initialEntry],
  })
  const router = createRouter({
    routeTree,
    history,
    context: { queryClient } satisfies RouterContext,
  })

  await router.load()

  const tree = (
    <QueryClientProvider client={queryClient}>
      <DirectionProvider defaultDirection="ltr">
        <ThemeProvider>
          <SearchProvider>
            <RouterProvider router={router} />
          </SearchProvider>
        </ThemeProvider>
      </DirectionProvider>
    </QueryClientProvider>
  )

  const rendered = render(
    options.wrapper ? options.wrapper(tree) : tree,
  )

  return { ...rendered, router, history } as RenderAdminRouteResult
}

export function locationSearch(
  router: ReturnType<typeof createRouter>,
): string {
  const search = router.state.location.search
  if (!search) return ''

  if (typeof search === 'object') {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(search as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value))
      }
    }
    const serialized = params.toString()
    return serialized ? `?${serialized}` : ''
  }

  const stringSearch = String(search)
  return stringSearch.startsWith('?') ? stringSearch : `?${stringSearch}`
}
