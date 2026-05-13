'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Card, CardContent, CardHeader } from '@repo/ui/card'
import { Skeleton } from '@repo/ui/skeleton'
import { ServiceCatalogManager } from '@/components/services/service-catalog-manager'
import { useAuth } from '@/components/auth-provider'
import {
  useBumpOfflineData,
  useManagerDataClient,
} from '@/components/manager-data-client-provider'
import type {
  Service,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'

function ServicesSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 bg-card px-3 py-2 border-b border-border/50">
        <Skeleton className="h-9 w-9 rounded-xl" />
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

export default function ServicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const dc = useManagerDataClient()
  const bumpOfflineData = useBumpOfflineData()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [families, setFamilies] = useState<ServiceFamily[]>([])
  const [loading, setLoading] = useState(true)

  const refreshCatalog = useCallback(async () => {
    if (!dc) return
    const [nextCategories, nextFamilies, nextServices] = await Promise.all([
      dc.services.categories.list({ includeInactive: true }),
      dc.services.families.list({ includeInactive: true }),
      dc.services.list({ includeInactive: true }),
    ])
    setCategories(nextCategories)
    setFamilies(nextFamilies)
    setServices(nextServices)
  }, [dc])

  useEffect(() => {
    if (user && user.role !== 'manager') {
      router.replace('/today')
    }
  }, [user, router])

  useEffect(() => {
    if (!dc || user?.role !== 'manager') {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void refreshCatalog().finally(() => {
      if (!cancelled) setLoading(false)
    })
    const unsubSvc = dc.services.subscribe((list) => {
      if (!cancelled) setServices(list)
    })

    return () => {
      cancelled = true
      unsubSvc()
    }
  }, [dc, refreshCatalog, user?.role])

  if (loading) {
    return <ServicesSkeleton />
  }

  if (!user || user.role !== 'manager') return null

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 bg-card px-3 py-2 border-b border-border/50">
        <Button
          variant="ghost"
          size="icon-sm"
          asChild
          className="h-9 w-9 shrink-0 rounded-xl touch-manipulation"
        >
          <Link href="/settings" aria-label="بازگشت به بیشتر">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold sm:text-lg">خدمات</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            بخش‌ها، گروه‌ها، قیمت و مدت زمان
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-2 pb-3 sm:p-4 sm:pb-6">
        <ServiceCatalogManager
          services={services}
          categories={categories}
          families={families}
          starterImportKey={`saloora:starter-services-used:${user.salonId}`}
          onChanged={() => {
            void refreshCatalog()
            bumpOfflineData()
          }}
        />
      </div>
    </div>
  )
}
