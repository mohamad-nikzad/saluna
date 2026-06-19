import { configureGeneratedApiClient } from '@repo/api-client/generated-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'

import { DirectionProvider } from '#/context/direction-provider'
import { SearchProvider } from '#/context/search-provider'
import { ThemeProvider } from '#/context/theme-provider'
import { queryClient } from '#/lib/query-client'
import { getRouter } from '#/router'

import './styles/index.css'

const rootElement = document.getElementById('app')!
configureGeneratedApiClient({ baseUrl: '', credentials: 'include' })
const router = getRouter({ queryClient })

if (!rootElement.innerHTML) {
  ReactDOM.createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <DirectionProvider defaultDirection="rtl">
        <ThemeProvider>
          <SearchProvider>
            <RouterProvider router={router} />
          </SearchProvider>
        </ThemeProvider>
      </DirectionProvider>
    </QueryClientProvider>,
  )
}
