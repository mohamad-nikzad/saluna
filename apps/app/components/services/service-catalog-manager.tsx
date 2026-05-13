'use client'

import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  FolderPlus,
  Layers3,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@repo/ui/collapsible'
import { Spinner } from '@repo/ui/spinner'
import type { Service, ServiceCategory, ServiceFamily } from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { useManagerDataClient } from '@/components/manager-data-client-provider'
import { ServiceCategoryDrawer } from './service-category-drawer'
import { ServiceDrawer } from './service-drawer'
import { ServiceFamilyDrawer } from './service-family-drawer'

interface ServiceCatalogManagerProps {
  services: Service[]
  categories: ServiceCategory[]
  families: ServiceFamily[]
  onChanged: () => void
}

type CategoryNode = ServiceCategory & {
  families: Array<ServiceFamily & { services: Service[] }>
}

function buildCatalog(
  categories: ServiceCategory[],
  families: ServiceFamily[],
  services: Service[],
): CategoryNode[] {
  const familiesByCategory = new Map<string, Array<ServiceFamily & { services: Service[] }>>()
  const servicesByFamily = new Map<string, Service[]>()

  for (const service of services) {
    if (!service.familyId) continue
    const list = servicesByFamily.get(service.familyId) ?? []
    list.push(service)
    servicesByFamily.set(service.familyId, list)
  }

  for (const family of families) {
    const list = familiesByCategory.get(family.categoryId) ?? []
    list.push({ ...family, services: servicesByFamily.get(family.id) ?? [] })
    familiesByCategory.set(family.categoryId, list)
  }

  return categories.map((category) => ({
    ...category,
    families: familiesByCategory.get(category.id) ?? [],
  }))
}

export function ServiceCatalogManager({
  services,
  categories,
  families,
  onChanged,
}: ServiceCatalogManagerProps) {
  const dc = useManagerDataClient()
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [familyDrawerOpen, setFamilyDrawerOpen] = useState(false)
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<ServiceFamily | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null)
  const [defaultFamilyId, setDefaultFamilyId] = useState<string | null>(null)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const catalog = useMemo(
    () => buildCatalog(categories, families, services),
    [categories, families, services],
  )

  const addCategory = () => {
    setSelectedCategory(null)
    setCategoryDrawerOpen(true)
  }

  const addFamily = (categoryId?: string) => {
    setSelectedFamily(null)
    setDefaultCategoryId(categoryId ?? categories[0]?.id ?? null)
    setFamilyDrawerOpen(true)
  }

  const addService = (familyId?: string) => {
    setSelectedService(null)
    setDefaultFamilyId(familyId ?? families[0]?.id ?? null)
    setServiceDrawerOpen(true)
  }

  const importTemplates = async () => {
    if (!dc) return
    setImporting(true)
    setError(null)
    try {
      await dc.services.importStarterTemplates()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'افزودن خدمات پیشنهادی انجام نشد')
    } finally {
      setImporting(false)
    }
  }

  const noCatalog = categories.length === 0 && families.length === 0 && services.length === 0

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">خدمات</CardTitle>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1 touch-manipulation"
              onClick={addCategory}
            >
              <FolderPlus className="h-4 w-4" />
              دسته
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              size="sm"
              variant="outline"
              className="justify-center gap-1 touch-manipulation"
              onClick={() => addFamily()}
              disabled={categories.length === 0}
            >
              <Layers3 className="h-4 w-4" />
              خانواده
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="justify-center gap-1 touch-manipulation"
              onClick={() => addService()}
              disabled={families.length === 0}
            >
              <Plus className="h-4 w-4" />
              خدمت
            </Button>
            <Button
              size="sm"
              className="justify-center gap-1 touch-manipulation"
              onClick={importTemplates}
              disabled={importing}
            >
              {importing ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              افزودن خدمات پیشنهادی
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardHeader>
        <CardContent className="space-y-2">
          {noCatalog ? (
            <div className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-center">
              <p className="text-sm text-muted-foreground">هنوز کاتالوگ خدمات ساخته نشده.</p>
            </div>
          ) : (
            catalog.map((category) => {
              const categoryOpen = openCategories[category.id] ?? true
              return (
                <Collapsible
                  key={category.id}
                  open={categoryOpen}
                  onOpenChange={(open) =>
                    setOpenCategories((current) => ({ ...current, [category.id]: open }))
                  }
                  className="rounded-lg border border-border/50 bg-card/50"
                >
                  <div className="flex items-center gap-1 px-2 py-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="shrink-0">
                        {categoryOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {toPersianDigits(category.families.length)} خانواده
                      </p>
                    </div>
                    {!category.active && (
                      <Badge variant="secondary" className="text-[10px]">
                        غیرفعال
                      </Badge>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedCategory(category)
                        setCategoryDrawerOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => addFamily(category.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <CollapsibleContent className="space-y-2 border-t border-border/40 p-2">
                    {category.families.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">
                        خانواده‌ای برای این دسته ثبت نشده.
                      </p>
                    ) : (
                      category.families.map((family) => {
                        const familyOpen = openFamilies[family.id] ?? true
                        return (
                          <Collapsible
                            key={family.id}
                            open={familyOpen}
                            onOpenChange={(open) =>
                              setOpenFamilies((current) => ({ ...current, [family.id]: open }))
                            }
                            className="rounded-md bg-muted/30"
                          >
                            <div className="flex items-center gap-1 px-2 py-2">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon-sm" className="shrink-0">
                                  {familyOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronLeft className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{family.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {toPersianDigits(family.services.length)} خدمت
                                </p>
                              </div>
                              {!family.active && (
                                <Badge variant="secondary" className="text-[10px]">
                                  غیرفعال
                                </Badge>
                              )}
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedFamily(family)
                                  setFamilyDrawerOpen(true)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => addService(family.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <CollapsibleContent className="space-y-1 px-2 pb-2">
                              {family.services.length === 0 ? (
                                <p className="rounded-md border border-dashed border-border/50 px-3 py-3 text-xs text-muted-foreground">
                                  خدمتی در این خانواده نیست.
                                </p>
                              ) : (
                                family.services.map((service) => (
                                  <div
                                    key={service.id}
                                    className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2"
                                  >
                                    <div
                                      className="h-8 w-1.5 rounded-full"
                                      style={{
                                        backgroundColor: `var(--calendar-${service.color})`,
                                      }}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium">{service.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {toPersianDigits(service.duration)} دقیقه ·{' '}
                                        {toPersianDigits(service.price.toLocaleString('fa-IR'))}{' '}
                                        تومان
                                      </p>
                                    </div>
                                    {!service.active && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        غیرفعال
                                      </Badge>
                                    )}
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      className="shrink-0"
                                      onClick={() => {
                                        setSelectedService(service)
                                        setServiceDrawerOpen(true)
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          )}
        </CardContent>
      </Card>

      <ServiceCategoryDrawer
        open={categoryDrawerOpen}
        onOpenChange={(open) => {
          setCategoryDrawerOpen(open)
          if (!open) setSelectedCategory(null)
        }}
        category={selectedCategory}
        onSuccess={() => {
          setCategoryDrawerOpen(false)
          setSelectedCategory(null)
          onChanged()
        }}
      />
      <ServiceFamilyDrawer
        open={familyDrawerOpen}
        onOpenChange={(open) => {
          setFamilyDrawerOpen(open)
          if (!open) setSelectedFamily(null)
        }}
        family={selectedFamily}
        categories={categories}
        defaultCategoryId={defaultCategoryId}
        onSuccess={() => {
          setFamilyDrawerOpen(false)
          setSelectedFamily(null)
          onChanged()
        }}
      />
      <ServiceDrawer
        open={serviceDrawerOpen}
        onOpenChange={(open) => {
          setServiceDrawerOpen(open)
          if (!open) setSelectedService(null)
        }}
        service={selectedService}
        categories={categories}
        families={families}
        defaultFamilyId={defaultFamilyId}
        onSuccess={() => {
          setServiceDrawerOpen(false)
          setSelectedService(null)
          onChanged()
        }}
      />
    </>
  )
}
