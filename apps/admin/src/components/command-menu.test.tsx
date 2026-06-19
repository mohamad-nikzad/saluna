import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'

import { CommandMenu } from '#/components/command-menu'
import { AdminAuthProvider } from '#/context/admin-auth-provider'
import { SearchProvider, useSearch } from '#/context/search-provider'

function OpenOnMount() {
  const { setOpen } = useSearch()

  useEffect(() => {
    setOpen(true)
  }, [setOpen])

  return null
}

function renderCommandMenu() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <SearchProvider>
          <AdminAuthProvider
            me={{
              userId: 'user-1',
              name: 'Test Admin',
              email: 'admin@test.com',
              phoneNumber: null,
              username: null,
              role: 'platform_owner',
              active: true,
            }}
            runtime={{ dataSource: 'local' }}
          >
            <OpenOnMount />
            <CommandMenu />
          </AdminAuthProvider>
        </SearchProvider>
      </QueryClientProvider>
    ),
  })

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
    context: { queryClient },
  })

  return render(<RouterProvider router={router} />)
}

describe('CommandMenu', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens the command dialog', async () => {
    renderCommandMenu()

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(
      screen.getByPlaceholderText(/جستجوی مسیرها و عملیات ادمین/i),
    ).toBeTruthy()
  })

  it('filters routes and quick actions by search query', async () => {
    renderCommandMenu()
    await screen.findByRole('dialog')

    const input = screen.getByPlaceholderText(/جستجوی مسیرها و عملیات ادمین/i)
    fireEvent.change(input, { target: { value: 'سالن' } })

    await waitFor(() => {
      expect(screen.getByText('سالن‌ها')).toBeTruthy()
      expect(screen.queryByText('نمای کلی')).toBeNull()
    })

    fireEvent.change(input, { target: { value: 'ممیزی' } })

    await waitFor(() => {
      expect(screen.getByText('رویدادهای اخیر ممیزی')).toBeTruthy()
      expect(screen.queryByText('سالن‌ها')).toBeNull()
    })
  })

  it('closes on Escape', async () => {
    renderCommandMenu()
    await screen.findByRole('dialog')

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})
