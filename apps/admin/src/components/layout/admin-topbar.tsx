import { Moon, Search, Sun } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { IconButton } from '#/components/ui/icon-button'
import { Separator } from '#/components/ui/separator'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { useSearch } from '#/context/search-provider'
import { useTheme } from '#/context/theme-provider'

export function AdminTopbar() {
  const { setOpen } = useSearch()
  const { theme, toggleTheme } = useTheme()
  const ThemeIcon = theme === 'light' ? Moon : Sun

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="-me-1" />
        <Separator orientation="vertical" className="me-2 h-4" />
        <Button
          variant="outline"
          className="h-8 min-w-0 flex-1 justify-start gap-2 text-muted-foreground shadow-none sm:max-w-md"
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className="truncate">Search admin routes and actions</span>
          <kbd className="ms-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Ctrl K
          </kbd>
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <IconButton label="Toggle theme" onClick={toggleTheme}>
            <ThemeIcon className="h-4 w-4" />
          </IconButton>
          <div className="hidden min-w-36 text-end sm:block">
            <div className="text-sm font-medium">Platform Admin</div>
            <div className="text-xs text-muted-foreground">Owner preview</div>
          </div>
        </div>
      </div>
    </header>
  )
}
