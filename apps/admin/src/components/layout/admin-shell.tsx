import { Outlet } from '@tanstack/react-router'

import { AppSidebar } from '#/components/app-sidebar'
import { CommandMenu } from '#/components/command-menu'
import { AdminTopbar } from '#/components/layout/admin-topbar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'

export function AdminShell() {
  return (
    <SidebarProvider>
      <AppSidebar side="right" collapsible="icon" />
      <SidebarInset className="overflow-hidden">
        <AdminTopbar />
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
      <CommandMenu />
    </SidebarProvider>
  )
}
