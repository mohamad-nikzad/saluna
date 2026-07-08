import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { Card, CardContent, CardHeader } from '@repo/ui/card'
import { Skeleton } from '@repo/ui/skeleton'

import { brand } from '@repo/brand'
import { ServiceAddonManager } from '#/components/services/service-addon-manager'
import { ServiceCatalogManager } from '#/components/services/service-catalog-manager'
import { ServicePackageManager } from '#/components/services/service-package-manager'
import { useAuth } from '#/lib/auth'
import { serviceCatalogQueryOptions } from '#/lib/services-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'

export const Route = createFileRoute('/_authed/services')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  component: ServicesPage,
})

function ServicesSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 bg-card px-3 py-2 border-b border-border/50">
        <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="hidden h-3 w-40 sm:block" />
        </div>
      </header>
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        <Card className="gap-0 border-border/50 py-0">
          <CardHeader className="space-y-2 px-2 py-2 sm:px-4 sm:py-4">
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-3 gap-1.5">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-2 pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ServicesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const catalogQuery = useQuery({
    ...serviceCatalogQueryOptions(),
    enabled: user?.role === 'manager',
  })
  const staffQuery = useQuery({
    ...staffListQueryOptions(),
    enabled: user?.role === 'manager',
  })
  const categories = catalogQuery.data?.categories ?? []
  const services = catalogQuery.data?.services ?? []
  const staff = staffQuery.data ?? []

  const refreshCatalog = () => {
    void queryClient.invalidateQueries({
      queryKey: serviceCatalogQueryOptions().queryKey,
    })
  }

  if (catalogQuery.isPending) {
    return <ServicesSkeleton />
  }

  if (!user || user.role !== 'manager') return null

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 bg-card px-3 py-2 border-b border-border/50">
        <PageHeaderBackButton
          aria-label="بازگشت به بیشتر"
          onClick={() => navigate({ to: '/settings' })}
        />
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold sm:text-lg">خدمات</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            بخش‌ها، خدمات، افزودنی‌ها و پکیج‌ها
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-auto p-2 pb-3 sm:space-y-4 sm:p-4 sm:pb-6">
        <ServiceAddonManager
          services={services}
          categories={categories}
          onChanged={refreshCatalog}
        />
        <ServicePackageManager
          services={services}
          categories={categories}
          staff={staff}
          onChanged={refreshCatalog}
        />
        <ServiceCatalogManager
          services={services}
          categories={categories}
          starterImportKey={brand.storage.starterServicesUsed(user.salonId)}
          onChanged={refreshCatalog}
        />
      </div>
    </div>
  )
}
