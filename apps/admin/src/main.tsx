import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { DirectionProvider } from '#/context/direction-provider'
import { LayoutProvider } from '#/context/layout-provider'
import { SearchProvider } from '#/context/search-provider'
import { ThemeProvider } from '#/context/theme-provider'
import { queryClient } from '#/lib/query-client'
import { router } from '#/router'

import './styles/index.css'

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider defaultDirection="rtl">
        <ThemeProvider>
          <LayoutProvider>
            <SearchProvider>
              <RouterProvider router={router} />
            </SearchProvider>
          </LayoutProvider>
        </ThemeProvider>
      </DirectionProvider>
    </QueryClientProvider>,
  )
}
