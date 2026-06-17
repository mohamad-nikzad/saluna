import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '#/components/ui/sidebar'

export function NavMain({
  items,
}: {
  items: {
    title: string
    items: {
      title: string
      href: string
      icon?: LucideIcon
    }[]
  }[]
}) {
  const location = useLocation()

  return (
    <>
      {items.map((group) => {
        const active = group.items.some((item) => item.href === location.pathname)
        const GroupIcon = group.items[0]?.icon

        return (
          <SidebarGroup key={group.title}>
            <SidebarMenu>
              <Collapsible asChild defaultOpen={active} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={group.title} isActive={active}>
                      {GroupIcon ? <GroupIcon /> : null}
                      <span>{group.title}</span>
                      <ChevronRight className="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {group.items.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          <SidebarMenuSubButton asChild isActive={item.href === location.pathname}>
                            <Link to={item.href}>
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroup>
        )
      })}
    </>
  )
}
