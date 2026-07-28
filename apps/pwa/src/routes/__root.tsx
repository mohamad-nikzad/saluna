import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import type { RouterContext } from '#/router'
import { DefaultRouteError } from '#/components/default-route-error'
import { ServiceWorkerRegister } from '#/components/pwa/service-worker-register'
import { InstallPrompt } from '#/components/pwa/install-prompt'
import '../styles.css'

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: DefaultRouteError,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <ServiceWorkerRegister />
      <InstallPrompt />
      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
