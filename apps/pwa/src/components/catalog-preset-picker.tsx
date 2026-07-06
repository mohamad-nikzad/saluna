import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronLeft,
  LayoutGrid,
  Lock,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { Card } from '@repo/ui/card'
import { Checkbox } from '@repo/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/collapsible'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { ApplyCatalogPresetBody } from '@repo/salon-core/forms/catalog-preset'

import { getMutationErrorMessage } from '#/lib/query-client'
import {
  catalogPresetsQueryOptions,
  useApplyCatalogPresetMutation,
  type CatalogPresetListItem,
} from '#/lib/services-queries'

export type ApplyPresetResult = {
  importedCategoryIds: string[]
  importedVariantIds: string[]
}

export type CatalogPresetPickerState = {
  applying: boolean
  canApply: boolean
  selectedCount: number
  selectedPresetName: string | null
}

export type CatalogPresetPickerHandle = {
  applySelectedPreset: () => Promise<boolean>
}

const POST_APPLY_HINT =
  'می‌توانید قیمت و جزئیات هر خدمت را بعداً از بخش خدمات تغییر دهید.'

function serviceKey(categoryIndex: number, serviceIndex: number) {
  return `${categoryIndex}:${serviceIndex}`
}

function allServiceKeys(tree: CatalogPresetListItem['tree']) {
  const keys: string[] = []
  tree.forEach((category, categoryIndex) =>
    category.services.forEach((_, serviceIndex) =>
      keys.push(serviceKey(categoryIndex, serviceIndex)),
    ),
  )
  return keys
}

function buildSelection(
  tree: CatalogPresetListItem['tree'],
  checked: Set<string>,
): ApplyCatalogPresetBody['selection'] {
  const selection: ApplyCatalogPresetBody['selection'] = []
  tree.forEach((category, categoryIndex) => {
    const serviceIndices: number[] = []
    category.services.forEach((_, serviceIndex) => {
      if (checked.has(serviceKey(categoryIndex, serviceIndex))) {
        serviceIndices.push(serviceIndex)
      }
    })
    if (serviceIndices.length > 0) {
      selection.push({ categoryIndex, serviceIndices })
    }
  })
  return selection
}

export const CatalogPresetPicker = forwardRef<
  CatalogPresetPickerHandle,
  {
    onApplied: (result: ApplyPresetResult) => void
    onManual?: () => void
    onStateChange?: (state: CatalogPresetPickerState) => void
    showApplyButton?: boolean
    className?: string
  }
>(function CatalogPresetPicker(
  { onApplied, onManual, onStateChange, showApplyButton = true, className },
  ref,
) {
  const presetsQuery = useQuery(catalogPresetsQueryOptions())
  const presets = presetsQuery.data ?? []
  const [selected, setSelected] = useState<CatalogPresetListItem | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>(
    {},
  )

  const applyPreset = useApplyCatalogPresetMutation()

  const openPreset = (preset: CatalogPresetListItem) => {
    applyPreset.reset()
    setSelected(preset)
    setChecked(new Set(allServiceKeys(preset.tree)))
    setOpenCategories({})
  }

  const closePreset = () => {
    setSelected(null)
    applyPreset.reset()
  }

  const selection = useMemo(
    () => (selected ? buildSelection(selected.tree, checked) : []),
    [selected, checked],
  )
  const selectedCount = selection.reduce(
    (sum, category) => sum + category.serviceIndices.length,
    0,
  )

  const toggleService = (categoryIndex: number, serviceIndex: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      const key = serviceKey(categoryIndex, serviceIndex)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleCategory = (
    tree: CatalogPresetListItem['tree'],
    categoryIndex: number,
  ) => {
    const keys = tree[categoryIndex].services.map((_, serviceIndex) =>
      serviceKey(categoryIndex, serviceIndex),
    )
    const allOn = keys.every((key) => checked.has(key))
    setChecked((prev) => {
      const next = new Set(prev)
      keys.forEach((key) => (allOn ? next.delete(key) : next.add(key)))
      return next
    })
  }

  const canApply = Boolean(selected && selection.length > 0)

  const onApply = useCallback(async (): Promise<boolean> => {
    if (!selected || selection.length === 0) return false
    try {
      const result = await applyPreset.mutateAsync({
        presetId: selected.id,
        selection,
      })
      onApplied(result)
      return true
    } catch {
      return false
    }
  }, [applyPreset, onApplied, selected, selection])

  useImperativeHandle(
    ref,
    () => ({
      applySelectedPreset: onApply,
    }),
    [onApply],
  )

  useEffect(() => {
    onStateChange?.({
      applying: applyPreset.isPending,
      canApply,
      selectedCount,
      selectedPresetName: selected?.name ?? null,
    })
  }, [
    applyPreset.isPending,
    canApply,
    onStateChange,
    selected?.name,
    selectedCount,
  ])

  const loadError = presetsQuery.error
    ? getMutationErrorMessage(
        presetsQuery.error,
        'بارگذاری قالب‌ها انجام نشد. دوباره تلاش کنید.',
      )
    : null
  const applyError = applyPreset.error
    ? getMutationErrorMessage(applyPreset.error, 'افزودن قالب انجام نشد')
    : null

  if (presetsQuery.isPending) {
    return (
      <div className={cn('flex items-center justify-center py-10', className)}>
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={cn('space-y-3 py-6 text-center', className)}>
        <p className="text-sm text-destructive">{loadError}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void presetsQuery.refetch()}
        >
          تلاش دوباره
        </Button>
      </div>
    )
  }

  if (selected) {
    const tree = selected.tree
    return (
      <div className={cn('space-y-3', className)} dir="rtl">
        <div className="flex items-center gap-2">
          <PageHeaderBackButton
            onClick={closePreset}
            aria-label="بازگشت به قالب‌ها"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(selectedCount)} خدمت انتخاب شده
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tree.map((category, categoryIndex) => {
            const categoryKeys = category.services.map((_, serviceIndex) =>
              serviceKey(categoryIndex, serviceIndex),
            )
            const checkedCount = categoryKeys.filter((key) =>
              checked.has(key),
            ).length
            const categoryState =
              checkedCount === 0
                ? false
                : checkedCount === categoryKeys.length
                  ? true
                  : 'indeterminate'
            const open = openCategories[categoryIndex] ?? true

            return (
              <Collapsible
                key={categoryIndex}
                open={open}
                onOpenChange={(value) =>
                  setOpenCategories((current) => ({
                    ...current,
                    [categoryIndex]: value,
                  }))
                }
                className="overflow-hidden rounded-lg border border-border/60 bg-background"
              >
                <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-2 py-2">
                  <Checkbox
                    checked={categoryState}
                    onCheckedChange={() => toggleCategory(tree, categoryIndex)}
                    aria-label={`انتخاب بخش ${category.name}`}
                  />
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-right"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {category.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {toPersianDigits(category.services.length)} خدمت
                        </span>
                      </span>
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1 p-2">
                  {category.services.map((service, serviceIndex) => (
                    <label
                      key={serviceIndex}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-2"
                    >
                      <Checkbox
                        checked={checked.has(
                          serviceKey(categoryIndex, serviceIndex),
                        )}
                        onCheckedChange={() =>
                          toggleService(categoryIndex, serviceIndex)
                        }
                        aria-label={`انتخاب خدمت ${service.name}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {service.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {toPersianDigits(service.duration)} دقیقه
                        {service.price > 0
                          ? ` · ${toPersianDigits(service.price.toLocaleString('fa-IR'))} تومان`
                          : ''}
                      </span>
                    </label>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          {POST_APPLY_HINT}
        </p>
        {applyError && <p className="text-xs text-destructive">{applyError}</p>}
        {showApplyButton && (
          <Button
            className="w-full gap-2"
            onClick={() => void onApply()}
            disabled={applyPreset.isPending || !canApply}
          >
            {applyPreset.isPending && <Spinner className="ml-2" />}
            افزودن {toPersianDigits(selectedCount)} خدمت به سالن
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)} dir="rtl">
      {presets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
          <p className="text-sm font-medium">قالب آماده‌ای موجود نیست.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {presets.map((preset) => {
            const serviceTotal = allServiceKeys(preset.tree).length
            return (
              <Card
                key={preset.id}
                className={cn(
                  'flex flex-col gap-2 border-border/60 p-4 text-right transition-colors',
                  preset.disabled
                    ? 'opacity-60'
                    : 'cursor-pointer hover:border-primary/40 hover:bg-primary/5',
                )}
                role={preset.disabled ? undefined : 'button'}
                onClick={() => !preset.disabled && openPreset(preset)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {preset.disabled ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <LayoutGrid className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{preset.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {toPersianDigits(preset.tree.length)} بخش ·{' '}
                      {toPersianDigits(serviceTotal)} خدمت
                    </p>
                  </div>
                </div>
                {preset.description && (
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {preset.description}
                  </p>
                )}
                {preset.disabled && preset.disabledReason === 'collision' && (
                  <Badge variant="secondary" className="w-fit text-[10px]">
                    بخش‌های این قالب از قبل در سالن موجود است
                  </Badge>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {onManual && (
        <Button variant="outline" className="w-full gap-2" onClick={onManual}>
          <Sparkles className="h-4 w-4" />
          ساخت دستی خدمت
        </Button>
      )}
    </div>
  )
})
