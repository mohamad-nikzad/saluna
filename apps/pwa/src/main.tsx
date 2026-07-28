import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'

import '#/lib/generated-api-client'
import { getRouter } from './router'
import { AuthProvider, registerAuthQueryDefaults } from './lib/auth'
import { queryClient } from './lib/query-client'
import { ThemeProvider } from './lib/theme'
import { AppErrorBoundary } from './components/app-error-boundary'
import { Toaster } from './components/ui/sonner'

registerAuthQueryDefaults(queryClient)

const router = getRouter({ queryClient })

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AuthProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}
