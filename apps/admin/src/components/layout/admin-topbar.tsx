import { Moon, Search, Sun } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { IconButton } from '#/components/ui/icon-button'
import { Separator } from '#/components/ui/separator'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { useAdminAuth } from '#/context/admin-auth-provider'
import { useSearch } from '#/context/search-provider'
import { useTheme } from '#/context/theme-provider'
import { cn } from '#/lib/utils'

export function AdminTopbar() {
  const { setOpen } = useSearch()
  const { theme, toggleTheme } = useTheme()
  const { runtime } = useAdminAuth()
  const ThemeIcon = theme === 'light' ? Moon : Sun
  const isLive = runtime.dataSource === 'live'

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="flex h-full w-full items-center gap-3 px-3 sm:px-5 lg:px-6">
        <SidebarTrigger className="-me-1" />
        <Separator orientation="vertical" className="me-1 h-4" />
        <Button
          variant="outline"
          className="h-8 min-w-0 flex-1 justify-start gap-2 border-input/80 bg-card/70 text-muted-foreground shadow-none sm:max-w-[34rem]"
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className="truncate">جستجوی مسیرها و عملیات ادمین</span>
          <kbd className="ms-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Ctrl K
          </kbd>
        </Button>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-semibold',
              isLive
                ? 'border-destructive bg-destructive text-destructive-foreground'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300',
            )}
          >
            {isLive ? 'داده LIVE' : 'داده محلی'}
          </span>
          <IconButton label="تغییر پوسته" onClick={toggleTheme}>
            <ThemeIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </header>
  )
}
