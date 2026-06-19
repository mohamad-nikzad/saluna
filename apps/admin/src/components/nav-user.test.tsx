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

import { NavUser } from '#/components/nav-user'
import { SidebarProvider } from '#/components/ui/sidebar'

const navigate = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: string
    children: ReactNode
  }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
}))

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderNavUser(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <NavUser
          role="platform_owner"
          user={{
            name: 'Platform Owner',
            email: 'owner@saluna.test',
            avatar: '',
          }}
        />
      </SidebarProvider>
    </QueryClientProvider>,
  )
}

describe('NavUser', () => {
  beforeEach(() => {
    navigate.mockReset()
    mockMatchMedia()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('signs out, clears cache, and navigates to login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    const clearSpy = vi.spyOn(queryClient, 'clear')
    queryClient.setQueryData(['admin-auth-me-test'], { user: { role: 'platform_owner' } })

    renderNavUser(queryClient)

    const trigger = screen.getByRole('button', { name: /Platform Owner/ })
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)

    fireEvent.click(await screen.findByRole('menuitem', { name: /خروج/ }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/v1/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    })
    expect(clearSpy).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({ to: '/login', replace: true })
  })
})
