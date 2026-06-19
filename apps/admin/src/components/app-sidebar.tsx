import { GalleryVerticalEnd } from 'lucide-react'

import { adminNavGroups, filterNavGroupsByRole } from '#/components/layout/nav-items'
import { NavMain } from '#/components/nav-main'
import { NavUser } from '#/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '#/components/ui/sidebar'
import { useAdminAuth } from '#/context/admin-auth-provider'

function getUserDisplayName(me: {
  name: string
  email: string
  phoneNumber: string | null
  username: string | null
}) {
  return me.name || me.email || me.phoneNumber || me.username || 'ادمین'
}

function getUserDisplayContact(me: {
  email: string
  phoneNumber: string | null
  username: string | null
}) {
  return me.email || me.phoneNumber || me.username || ''
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { me } = useAdminAuth()
  const navMain = filterNavGroupsByRole(adminNavGroups, me.role)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">ادمین Saluna</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          role={me.role}
          user={{
            name: getUserDisplayName(me),
            email: getUserDisplayContact(me),
            avatar: '',
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
