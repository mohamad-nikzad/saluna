import { createRootRoute, createRoute, createRouter, Navigate, Outlet } from '@tanstack/react-router'

import { AdminShell } from '#/components/layout/admin-shell'
import { AdminPage } from '#/features/admin-page'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin',
  component: AdminShell,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/overview" replace />,
})

const overviewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/overview',
  component: () => <AdminPage pageId="overview" />,
})

const salonsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/salons',
  component: () => <AdminPage pageId="salons" />,
})

const usersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/users',
  component: () => <AdminPage pageId="users" />,
})

const catalogPresetsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/catalog-presets',
  component: () => <AdminPage pageId="catalog-presets" />,
})

const messagingHealthRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/messaging-health',
  component: () => <AdminPage pageId="messaging-health" />,
})

const supportLookupRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/support-lookup',
  component: () => <AdminPage pageId="support-lookup" />,
})

const auditLogRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/audit-log',
  component: () => <AdminPage pageId="audit-log" />,
})

const platformAdminsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/platform-admins',
  component: () => <AdminPage pageId="platform-admins" />,
})

const settingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/settings',
  component: () => <AdminPage pageId="settings" />,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  adminRoute.addChildren([
    overviewRoute,
    salonsRoute,
    usersRoute,
    catalogPresetsRoute,
    messagingHealthRoute,
    supportLookupRoute,
    auditLogRoute,
    platformAdminsRoute,
    settingsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
