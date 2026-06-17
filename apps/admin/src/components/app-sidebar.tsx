import {
  GalleryVerticalEnd,
  LifeBuoy,
  ScrollText,
  Send,
  ShieldCheck,
} from 'lucide-react'

import { adminNavGroups } from '#/components/layout/nav-items'
import { NavMain } from '#/components/nav-main'
import { NavProjects } from '#/components/nav-projects'
import { NavUser } from '#/components/nav-user'
import { TeamSwitcher } from '#/components/team-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '#/components/ui/sidebar'

const data = {
  user: {
    name: 'Platform Admin',
    email: 'owner@saluna.ir',
    avatar: '',
  },
  teams: [
    {
      name: 'Saluna Admin',
      logo: GalleryVerticalEnd,
      plan: 'Internal Operations',
    },
  ],
  navMain: adminNavGroups,
  projects: [
    {
      name: 'Audit Log',
      url: '/audit-log',
      icon: ScrollText,
    },
    {
      name: 'Platform Admins',
      url: '/platform-admins',
      icon: ShieldCheck,
    },
    {
      name: 'Support Lookup',
      url: '/support-lookup',
      icon: LifeBuoy,
    },
    {
      name: 'Messaging Health',
      url: '/messaging-health',
      icon: Send,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
