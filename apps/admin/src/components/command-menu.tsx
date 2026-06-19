import { useNavigate } from '@tanstack/react-router'

import {
  adminNavItems,
  commandActions,
  filterNavItemsByRole,
} from '#/components/layout/nav-items'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import { useAdminAuth } from '#/context/admin-auth-provider'
import { useSearch } from '#/context/search-provider'

function commandItemValue(item: { title: string; keywords?: string[] }) {
  return [item.title, ...(item.keywords ?? [])].join(' ')
}

export function CommandMenu() {
  const navigate = useNavigate()
  const { me } = useAdminAuth()
  const { open, setOpen } = useSearch()
  const visibleNavItems = filterNavItemsByRole(adminNavItems, me.role)
  const visibleCommandActions = filterNavItemsByRole(commandActions, me.role)

  const runCommand = (href: string) => {
    setOpen(false)
    void navigate({ to: href })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="منوی فرمان ادمین"
      description="جستجوی مسیرها و عملیات سریع"
    >
      <CommandInput placeholder="جستجوی مسیرها و عملیات ادمین..." />
      <CommandList>
        <CommandEmpty>نتیجه‌ای یافت نشد.</CommandEmpty>
        <CommandGroup heading="مسیرها">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.href}
                value={commandItemValue(item)}
                onSelect={() => runCommand(item.href)}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        {visibleCommandActions.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="عملیات سریع">
              {visibleCommandActions.map((action) => {
                const Icon = action.icon
                return (
                  <CommandItem
                    key={action.title}
                    value={commandItemValue(action)}
                    onSelect={() => runCommand(action.href)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{action.title}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
