import { ApiError } from '@repo/api-client/errors'
import { getApiV1AdminAuthMeOptions } from '@repo/api-client/query'
import { Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { LogIn, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import { ErrorBoundary } from '#/components/admin/error-boundary'
import { AppSidebar } from '#/components/app-sidebar'
import { CommandMenu } from '#/components/command-menu'
import { AdminTopbar } from '#/components/layout/admin-topbar'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'
import { Skeleton } from '#/components/ui/skeleton'
import { AdminAuthProvider } from '#/context/admin-auth-provider'

export function AdminShell({ children }: { children?: ReactNode }) {
  const meQuery = useQuery({
    ...getApiV1AdminAuthMeOptions(),
    retry: false,
  })

  if (meQuery.isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-sidebar p-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (meQuery.isError) {
    const status = meQuery.error instanceof ApiError ? meQuery.error.status : 500
    const isUnauthenticated = status === 401
    return (
      <main className="grid min-h-svh place-items-center bg-sidebar p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">
              {isUnauthenticated
                ? 'ورود به پنل ادمین الزامی است'
                : 'دسترسی به پنل ادمین مجاز نیست'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isUnauthenticated
                ? 'با حسابی که نقش فعال ادمین پلتفرم دارد وارد شوید.'
                : 'نشست شما معتبر است، اما این حساب اجازه دسترسی به پنل ادمین Saluna را ندارد.'}
            </p>
            <Button asChild className="mt-5">
              <a href="/login">
                <LogIn className="h-4 w-4" />
                رفتن به صفحه ورود
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!meQuery.data) return null

  const { user: me, runtime } = meQuery.data

  return (
    <AdminAuthProvider me={me} runtime={runtime}>
      <SidebarProvider>
        <AppSidebar dir="rtl" side="right" variant="inset" collapsible="icon" />
        <SidebarInset className="min-h-svh overflow-hidden">
          <AdminTopbar />
          {runtime.dataSource === 'live' ? (
            <div className="border-b border-destructive/35 bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground">
              به داده‌های LIVE تولید متصل هستید. تغییرات این پنل روی داده‌های واقعی
              اعمال می‌شود.
            </div>
          ) : null}
          <main className="flex w-full flex-1 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-7">
            <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
          </main>
        </SidebarInset>
        <CommandMenu />
      </SidebarProvider>
    </AdminAuthProvider>
  )
}
