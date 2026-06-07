import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  FolderPlus,
  Layers3,
  LayoutTemplate,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Badge } from '@repo/ui/badge'
import { Card, CardTitle } from '@repo/ui/card'
import { Input } from '@repo/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/collapsible'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/sheet'
import { Spinner } from '@repo/ui/spinner'
import type {
  Service,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { CatalogPresetPicker } from '#/components/catalog-preset-picker'
import { useImportStarterTemplatesMutation } from '#/lib/services-queries'
import { ServiceCategoryDrawer } from './service-category-drawer'
import { ServiceDrawer } from './service-drawer'
import { ServiceFamilyDrawer } from './service-family-drawer'
import { buildCatalog } from './catalog-tree'
import type { CategoryNode } from './catalog-tree'
import { brand } from '@repo/brand'
import { ServiceRow } from './service-row'

interface ServiceCatalogManagerProps {
  services: Service[]
  categories: ServiceCategory[]
  families: ServiceFamily[]
  starterImportKey?: string
  onChanged: () => void
}

const STARTER_SERVICES_USED_KEY = brand.storage.starterServicesUsedBase

export function ServiceCatalogManager({
  services,
  categories,
  families,
  starterImportKey = STARTER_SERVICES_USED_KEY,
  onChanged,
}: ServiceCatalogManagerProps) {
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [familyDrawerOpen, setFamilyDrawerOpen] = useState(false)
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] =
    useState<ServiceCategory | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<ServiceFamily | null>(
    null,
  )
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(
    null,
  )
  const [defaultFamilyId, setDefaultFamilyId] = useState<string | null>(null)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {},
  )
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>({})
  const [presetSheetOpen, setPresetSheetOpen] = useState(false)
  const [highlightedCategoryIds, setHighlightedCategoryIds] = useState<
    string[]
  >([])
  const [starterImportUsed, setStarterImportUsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.localStorage.getItem(starterImportKey) === '1',
  )

  const importTemplatesMutation = useImportStarterTemplatesMutation()

  const importTemplates = () => {
    importTemplatesMutation.mutate(undefined, {
      onSuccess: () => {
        window.localStorage.setItem(starterImportKey, '1')
        setStarterImportUsed(true)
        onChanged()
      },
    })
  }

  const importing = importTemplatesMutation.isPending
  const [search, setSearch] = useState('')

  const catalog = useMemo(
    () => buildCatalog(categories, families, services),
    [categories, families, services],
  )
  const activeServicesCount = useMemo(
    () => services.filter((service) => service.active).length,
    [services],
  )
  const inactiveServicesCount = services.length - activeServicesCount
  const visibleCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa-IR')
    if (!query) return catalog

    return catalog
      .map((category) => {
        const categoryMatches = category.name
          .toLocaleLowerCase('fa-IR')
          .includes(query)

        const visibleFamilies = category.families
          .map((family) => {
            const familyMatches = family.name
              .toLocaleLowerCase('fa-IR')
              .includes(query)
            const visibleServices =
              categoryMatches || familyMatches
                ? family.services
                : family.services.filter((service) =>
                    service.name.toLocaleLowerCase('fa-IR').includes(query),
                  )

            if (
              !categoryMatches &&
              !familyMatches &&
              visibleServices.length === 0
            )
              return null
            return { ...family, services: visibleServices }
          })
          .filter(
            (
              family,
            ): family is ServiceFamily & {
              services: Service[]
            } => Boolean(family),
          )

        const visibleUngrouped = categoryMatches
          ? category.ungroupedServices
          : category.ungroupedServices.filter((service) =>
              service.name.toLocaleLowerCase('fa-IR').includes(query),
            )

        if (
          !categoryMatches &&
          visibleFamilies.length === 0 &&
          visibleUngrouped.length === 0
        )
          return null
        return {
          ...category,
          families: visibleFamilies,
          ungroupedServices: visibleUngrouped,
        }
      })
      .filter((category): category is CategoryNode => Boolean(category))
  }, [catalog, search])

  const addCategory = () => {
    setSelectedCategory(null)
    setCategoryDrawerOpen(true)
  }

  const addFamily = (categoryId?: string) => {
    setSelectedFamily(null)
    setDefaultCategoryId(
      categoryId !== undefined ? categoryId : (categories[0]?.id ?? null),
    )
    setFamilyDrawerOpen(true)
  }

  const addService = (categoryId?: string, familyId?: string) => {
    setSelectedService(null)
    setDefaultCategoryId(
      categoryId !== undefined ? categoryId : (categories[0]?.id ?? null),
    )
    setDefaultFamilyId(familyId ?? null)
    setServiceDrawerOpen(true)
  }

  const onPresetApplied = (result: { importedCategoryIds: string[] }) => {
    setPresetSheetOpen(false)
    setHighlightedCategoryIds(result.importedCategoryIds)
    setOpenCategories((current) => {
      const next = { ...current }
      for (const id of result.importedCategoryIds) next[id] = true
      return next
    })
    onChanged()
  }

  useEffect(() => {
    if (highlightedCategoryIds.length === 0) return
    const timer = window.setTimeout(
      () => setHighlightedCategoryIds([]),
      4000,
    )
    return () => window.clearTimeout(timer)
  }, [highlightedCategoryIds])

  const noCatalog =
    categories.length === 0 && families.length === 0 && services.length === 0
  const showStarterImport = noCatalog && !starterImportUsed
  const noSearchResults = !noCatalog && visibleCatalog.length === 0

  useEffect(() => {
    setStarterImportUsed(window.localStorage.getItem(starterImportKey) === '1')
  }, [starterImportKey])

  return (
    <>
      <Card className="gap-0 border-border/50 bg-card/95 py-0">
        <div className="space-y-4 px-2 py-2 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold sm:text-base">
                لیست خدمات
              </CardTitle>
              <p className="hidden text-xs leading-5 text-muted-foreground sm:block">
                ساختار خدمات را از بخش، گروه و خدمت مدیریت کنید.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center sm:min-w-64 sm:gap-2">
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(categories.length)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  بخش
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(families.length)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  گروه
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(services.length)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  خدمت
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-4">
            <div className="relative col-span-3 sm:col-span-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جستجوی خدمت، گروه یا بخش…"
                className="h-9 bg-blush-soft pr-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="justify-center gap-1 touch-manipulation"
              onClick={() => addService()}
              disabled={categories.length === 0}
            >
              <Plus className="h-4 w-4" />
              خدمت
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="justify-center gap-1 touch-manipulation"
              onClick={() => addFamily()}
              disabled={categories.length === 0}
            >
              <Layers3 className="h-4 w-4" />
              گروه
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="justify-center gap-1 touch-manipulation"
              onClick={addCategory}
            >
              <FolderPlus className="h-4 w-4" />
              بخش
            </Button>
          </div>
          {inactiveServicesCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(inactiveServicesCount)} خدمت غیرفعال در لیست
              نگهداری شده است.
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
            {showStarterImport ? (
              <Button
                size="sm"
                className="justify-center gap-1 touch-manipulation"
                onClick={importTemplates}
                disabled={importing}
              >
                {importing ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                شروع با لیست آماده
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="justify-center gap-1 touch-manipulation"
              onClick={() => setPresetSheetOpen(true)}
            >
              <LayoutTemplate className="h-4 w-4" />
              افزودن از قالب آماده
            </Button>
          </div>
        </div>
        <div className="space-y-2 px-2 pb-2 sm:space-y-3 sm:px-4 sm:pb-4">
          {noCatalog ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-center sm:px-4 sm:py-8">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:mb-3 sm:h-11 sm:w-11">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">هنوز خدمتی ثبت نشده.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                برای شروع، از لیست آماده استفاده کنید یا اولین بخش را بسازید.
              </p>
              <div className="mt-3 flex flex-col justify-center gap-2 sm:mt-4 sm:flex-row sm:gap-2">
                {showStarterImport && (
                  <Button
                    size="sm"
                    className="gap-1 touch-manipulation"
                    onClick={importTemplates}
                    disabled={importing}
                  >
                    {importing ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    شروع با لیست آماده
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 touch-manipulation"
                  onClick={addCategory}
                >
                  <FolderPlus className="h-4 w-4" />
                  ساخت بخش
                </Button>
              </div>
            </div>
          ) : noSearchResults ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-center sm:px-4 sm:py-8">
              <p className="text-sm font-medium">نتیجه‌ای پیدا نشد.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                عبارت جستجو را کوتاه‌تر کنید یا خدمت جدید بسازید.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 gap-1 touch-manipulation sm:mt-4"
                onClick={() => setSearch('')}
              >
                پاک کردن جستجو
              </Button>
            </div>
          ) : (
            visibleCatalog.map((category) => {
              const categoryOpen = openCategories[category.id] ?? true
              const categoryServiceCount =
                category.families.reduce(
                  (count, family) => count + family.services.length,
                  0,
                ) + category.ungroupedServices.length
              return (
                <Collapsible
                  key={category.id}
                  open={categoryOpen}
                  onOpenChange={(open) =>
                    setOpenCategories((current) => ({
                      ...current,
                      [category.id]: open,
                    }))
                  }
                  className={`overflow-hidden rounded-lg border bg-background transition-shadow ${
                    highlightedCategoryIds.includes(category.id)
                      ? 'border-primary ring-2 ring-primary/40'
                      : 'border-border/60'
                  }`}
                >
                  <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-1.5 py-1.5 sm:px-2 sm:py-2.5">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                        aria-label={categoryOpen ? 'بستن بخش' : 'باز کردن بخش'}
                      >
                        {categoryOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {category.name}
                        </p>
                        {!category.active && (
                          <Badge variant="secondary" className="text-[10px]">
                            غیرفعال
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">
                        {toPersianDigits(category.families.length)} گروه ·{' '}
                        {toPersianDigits(categoryServiceCount)} خدمت
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                      aria-label={`ویرایش بخش ${category.name}`}
                      onClick={() => {
                        setSelectedCategory(category)
                        setCategoryDrawerOpen(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                      aria-label={`افزودن گروه به ${category.name}`}
                      onClick={() => addFamily(category.id)}
                    >
                      <Layers3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                      aria-label={`افزودن خدمت به ${category.name}`}
                      onClick={() => addService(category.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <CollapsibleContent className="space-y-1.5 p-1.5 sm:space-y-2 sm:p-2">
                    {category.ungroupedServices.length > 0 ? (
                      <div className="space-y-1 sm:space-y-1.5">
                        {category.ungroupedServices.map((service) => (
                          <ServiceRow
                            key={service.id}
                            service={service}
                            onEdit={() => {
                              setSelectedService(service)
                              setServiceDrawerOpen(true)
                            }}
                          />
                        ))}
                      </div>
                    ) : null}
                    {category.families.length === 0 &&
                    category.ungroupedServices.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center sm:py-4">
                        <p className="text-xs text-muted-foreground">
                          هنوز خدمتی در این بخش نیست.
                        </p>
                        <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
                          <Button
                            size="sm"
                            className="gap-1 touch-manipulation"
                            onClick={() => addService(category.id)}
                          >
                            <Plus className="h-4 w-4" />
                            افزودن خدمت
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 touch-manipulation"
                            onClick={() => addFamily(category.id)}
                          >
                            <Layers3 className="h-4 w-4" />
                            ساخت گروه
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {category.families.map((family) => {
                        const familyOpen = openFamilies[family.id] ?? true
                        return (
                          <Collapsible
                            key={family.id}
                            open={familyOpen}
                            onOpenChange={(open) =>
                              setOpenFamilies((current) => ({
                                ...current,
                                [family.id]: open,
                              }))
                            }
                            className="overflow-hidden rounded-lg border border-border/50 bg-card"
                          >
                            <div className="flex items-center gap-2 px-1.5 py-1.5 sm:px-2 sm:py-2">
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                                  aria-label={
                                    familyOpen ? 'بستن گروه' : 'باز کردن گروه'
                                  }
                                >
                                  {familyOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronLeft className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium">
                                    {family.name}
                                  </p>
                                  {!family.active && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px]"
                                    >
                                      غیرفعال
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">
                                  {toPersianDigits(family.services.length)} خدمت
                                </p>
                              </div>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                                aria-label={`ویرایش گروه ${family.name}`}
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
                                className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                                aria-label={`افزودن خدمت به ${family.name}`}
                                onClick={() => addService(category.id, family.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <CollapsibleContent className="space-y-1 border-t border-border/40 bg-muted/20 p-1.5 sm:space-y-1.5 sm:p-2">
                              {family.services.length === 0 ? (
                                <div className="rounded-md border border-dashed border-border/60 bg-background px-3 py-3 text-center sm:py-4">
                                  <p className="text-xs text-muted-foreground">
                                    خدمتی در این گروه نیست.
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-3 gap-1 touch-manipulation"
                                    onClick={() => addService(category.id, family.id)}
                                  >
                                    <Plus className="h-4 w-4" />
                                    افزودن خدمت
                                  </Button>
                                </div>
                              ) : (
                                family.services.map((service) => (
                                  <ServiceRow
                                    key={service.id}
                                    service={service}
                                    onEdit={() => {
                                      setSelectedService(service)
                                      setServiceDrawerOpen(true)
                                    }}
                                  />
                                ))
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })}
                  </CollapsibleContent>
                </Collapsible>
              )
            })
          )}
        </div>
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
        services={services}
        categories={categories}
        families={families}
        defaultCategoryId={defaultCategoryId}
        defaultFamilyId={defaultFamilyId}
        onSuccess={() => {
          setServiceDrawerOpen(false)
          setSelectedService(null)
          onChanged()
        }}
      />

      <Sheet open={presetSheetOpen} onOpenChange={setPresetSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto"
          dir="rtl"
        >
          <SheetHeader className="text-right">
            <SheetTitle>افزودن از قالب آماده</SheetTitle>
            <SheetDescription>
              یک قالب را انتخاب کنید و خدمت‌های دلخواه را به سالن اضافه کنید.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <CatalogPresetPicker onApplied={onPresetApplied} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
