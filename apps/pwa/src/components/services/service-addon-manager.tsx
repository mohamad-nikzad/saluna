import { useMemo, useState } from 'react'
import { Banknote, Clock3, Pencil, Plus, Search, Sparkles } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardTitle } from '@repo/ui/card'
import { Input } from '@repo/ui/input'
import { Spinner } from '@repo/ui/spinner'
import type {
  Service,
  ServiceAddon,
  ServiceCategory,
} from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addonsListQueryOptions,
  getApiV1ServiceAddonsQueryKey,
} from '#/lib/services-queries'
import { getMutationErrorMessage } from '#/lib/query-client'
import { ServiceAddonDrawer } from './service-addon-drawer'

interface ServiceAddonManagerProps {
  categories: ServiceCategory[]
  services: Service[]
  onChanged: () => void
}

function scopeLabel(addon: ServiceAddon) {
  if (addon.scopes.length === 0) return 'بدون دامنه'
  if (addon.scopes.some((scope) => scope.type === 'all')) return 'همه خدمات'
  const counts = addon.scopes.reduce(
    (sum, scope) => ({
      category: sum.category + (scope.type === 'category' ? 1 : 0),
      service: sum.service + (scope.type === 'service' ? 1 : 0),
    }),
    { category: 0, service: 0 },
  )
  return [
    counts.category ? `${toPersianDigits(counts.category)} بخش` : null,
    counts.service ? `${toPersianDigits(counts.service)} خدمت` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function ServiceAddonManager({
  categories,
  services,
  onChanged,
}: ServiceAddonManagerProps) {
  const queryClient = useQueryClient()
  const {
    data: addons = [],
    isPending,
    error,
  } = useQuery(addonsListQueryOptions())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAddon, setSelectedAddon] = useState<ServiceAddon | null>(null)
  const [search, setSearch] = useState('')

  const errorMessage = error
    ? getMutationErrorMessage(error, 'خواندن افزودنی‌ها انجام نشد')
    : null

  const activeCount = addons.filter((addon) => addon.active).length
  const inactiveCount = addons.length - activeCount
  const filteredAddons = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa-IR')
    if (!query) return addons
    return addons.filter((addon) =>
      addon.name.toLocaleLowerCase('fa-IR').includes(query),
    )
  }, [addons, search])
  const nextSortOrder =
    addons.reduce((max, addon) => Math.max(max, addon.sortOrder), 0) + 10

  const openNew = () => {
    setSelectedAddon(null)
    setDrawerOpen(true)
  }

  const handleSuccess = () => {
    setDrawerOpen(false)
    setSelectedAddon(null)
    void queryClient.invalidateQueries({
      queryKey: getApiV1ServiceAddonsQueryKey({ query: { all: '1' } }),
    })
    onChanged()
  }

  return (
    <>
      <Card className="gap-0 border-border/50 bg-card/95 py-0">
        <div className="space-y-4 px-2 py-2 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold sm:text-base">
                افزودنی‌های خدمت
              </CardTitle>
              <p className="hidden text-xs leading-5 text-muted-foreground sm:block">
                گزینه‌های قابل اضافه شدن به رزرو را با دامنه همه خدمات، بخش یا
                خدمت مدیریت کنید.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center sm:min-w-64 sm:gap-2">
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(addons.length)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  کل
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(activeCount)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  فعال
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(inactiveCount)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  غیرفعال
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جستجوی افزودنی…"
                className="h-9 bg-blush-soft pr-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="justify-center gap-1 touch-manipulation"
              onClick={openNew}
            >
              <Plus className="h-4 w-4" />
              افزودنی
            </Button>
          </div>
          {errorMessage && (
            <p className="text-xs text-destructive">{errorMessage}</p>
          )}
        </div>
        <div className="space-y-2 px-2 pb-2 sm:space-y-3 sm:px-4 sm:pb-4">
          {isPending ? (
            <div className="flex items-center justify-center rounded-lg border border-border/60 bg-background py-8">
              <Spinner />
            </div>
          ) : filteredAddons.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-center sm:px-4 sm:py-8">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">
                {addons.length === 0
                  ? 'هنوز افزودنی ثبت نشده.'
                  : 'نتیجه‌ای پیدا نشد.'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                افزودنی‌ها مثل طراحی ناخن یا مواد اضافه به رزروهای مرتبط اضافه
                می‌شوند.
              </p>
            </div>
          ) : (
            filteredAddons.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:px-3 sm:py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{addon.name}</p>
                    {!addon.active && (
                      <Badge variant="secondary" className="text-[10px]">
                        غیرفعال
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {scopeLabel(addon)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:gap-1.5 sm:text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
                      <Banknote className="h-3 w-3" />
                      {addon.priceDelta > 0
                        ? `${toPersianDigits(addon.priceDelta.toLocaleString('fa-IR'))} تومان`
                        : 'بدون افزایش قیمت'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
                      <Clock3 className="h-3 w-3" />
                      {addon.durationDelta > 0
                        ? `${toPersianDigits(addon.durationDelta)} دقیقه`
                        : 'بدون افزایش زمان'}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                  aria-label={`ویرایش افزودنی ${addon.name}`}
                  onClick={() => {
                    setSelectedAddon(addon)
                    setDrawerOpen(true)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
      <ServiceAddonDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        addon={selectedAddon}
        categories={categories}
        services={services}
        nextSortOrder={nextSortOrder}
        onSuccess={handleSuccess}
      />
    </>
  )
}
