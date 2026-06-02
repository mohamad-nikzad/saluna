import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  LayoutGrid,
  Lock,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
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
import type { CatalogPresetTree } from '@repo/salon-core/forms/catalog-preset'
import type {
  ApplyCatalogPresetSelection,
  CatalogPresetListItem,
} from '@repo/data-client'

import { useManagerDataClient } from '#/lib/manager-data-client'
import { getMutationErrorMessage } from '#/lib/query-client'
import { catalogPresetsQueryKey } from '#/lib/query-keys'

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

function variantKey(c: number, f: number, v: number) {
  return `${c}:${f}:${v}`
}

function allVariantKeys(tree: CatalogPresetTree) {
  const keys: string[] = []
  tree.forEach((category, c) =>
    category.families.forEach((family, f) =>
      family.variants.forEach((_, v) => keys.push(variantKey(c, f, v))),
    ),
  )
  return keys
}

function buildSelection(
  tree: CatalogPresetTree,
  checked: Set<string>,
): ApplyCatalogPresetSelection {
  const selection: ApplyCatalogPresetSelection = []
  tree.forEach((category, c) => {
    const families: ApplyCatalogPresetSelection[number]['families'] = []
    category.families.forEach((family, f) => {
      const variantIndices: number[] = []
      family.variants.forEach((_, v) => {
        if (checked.has(variantKey(c, f, v))) variantIndices.push(v)
      })
      if (variantIndices.length > 0)
        families.push({ familyIndex: f, variantIndices })
    })
    if (families.length > 0) selection.push({ categoryIndex: c, families })
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
  {
    onApplied,
    onManual,
    onStateChange,
    showApplyButton = true,
    className,
  },
  ref,
) {
  const dc = useManagerDataClient()
  const presetsQuery = useQuery({
    queryKey: catalogPresetsQueryKey,
    queryFn: () => dc!.services.listCatalogPresets(),
    enabled: !!dc,
  })
  const presets = presetsQuery.data ?? []
  const [selected, setSelected] = useState<CatalogPresetListItem | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>(
    {},
  )

  const applyPreset = useMutation({
    mutationFn: ({
      presetId,
      selection,
    }: {
      presetId: string
      selection: ApplyCatalogPresetSelection
    }) => {
      if (!dc) throw new Error('اتصال داده برقرار نیست')
      return dc.services.applyCatalogPreset(presetId, selection)
    },
    meta: { skipToast: true, errorMessage: 'افزودن قالب انجام نشد' },
    onSuccess: (result) => onApplied(result),
  })

  const openPreset = (preset: CatalogPresetListItem) => {
    applyPreset.reset()
    setSelected(preset)
    setChecked(new Set(allVariantKeys(preset.tree)))
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
    (sum, cat) =>
      sum + cat.families.reduce((s, fam) => s + fam.variantIndices.length, 0),
    0,
  )

  const toggleVariant = (c: number, f: number, v: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      const key = variantKey(c, f, v)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleFamily = (tree: CatalogPresetTree, c: number, f: number) => {
    const family = tree[c].families[f]
    const keys = family.variants.map((_, v) => variantKey(c, f, v))
    const allOn = keys.every((k) => checked.has(k))
    setChecked((prev) => {
      const next = new Set(prev)
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)))
      return next
    })
  }

  const toggleCategory = (tree: CatalogPresetTree, c: number) => {
    const keys: string[] = []
    tree[c].families.forEach((family, f) =>
      family.variants.forEach((_, v) => keys.push(variantKey(c, f, v))),
    )
    const allOn = keys.every((k) => checked.has(k))
    setChecked((prev) => {
      const next = new Set(prev)
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)))
      return next
    })
  }

  const canApply = Boolean(dc && selected && selection.length > 0)

  const onApply = useCallback(async (): Promise<boolean> => {
    if (!selected || selection.length === 0) return false
    try {
      await applyPreset.mutateAsync({
        presetId: selected.id,
        selection,
      })
      return true
    } catch {
      return false
    }
  }, [applyPreset, selected, selection])

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
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 shrink-0 rounded-xl"
            onClick={closePreset}
            aria-label="بازگشت به قالب‌ها"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{selected.name}</p>
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(selectedCount)} خدمت انتخاب شده
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tree.map((category, c) => {
            const categoryKeys: string[] = []
            category.families.forEach((family, f) =>
              family.variants.forEach((_, v) =>
                categoryKeys.push(variantKey(c, f, v)),
              ),
            )
            const checkedCount = categoryKeys.filter((k) =>
              checked.has(k),
            ).length
            const categoryState =
              checkedCount === 0
                ? false
                : checkedCount === categoryKeys.length
                  ? true
                  : 'indeterminate'
            const open = openCategories[c] ?? true
            return (
              <Collapsible
                key={c}
                open={open}
                onOpenChange={(value) =>
                  setOpenCategories((cur) => ({ ...cur, [c]: value }))
                }
                className="overflow-hidden rounded-lg border border-border/60 bg-background"
              >
                <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-2 py-2">
                  <Checkbox
                    checked={categoryState}
                    onCheckedChange={() => toggleCategory(tree, c)}
                    aria-label={`انتخاب دسته ${category.name}`}
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
                          {toPersianDigits(category.families.length)} گروه ·{' '}
                          {toPersianDigits(categoryKeys.length)} خدمت
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
                <CollapsibleContent className="space-y-2 p-2">
                  {category.families.map((family, f) => {
                    const familyKeys = family.variants.map((_, v) =>
                      variantKey(c, f, v),
                    )
                    const familyChecked = familyKeys.filter((k) =>
                      checked.has(k),
                    ).length
                    const familyState =
                      familyChecked === 0
                        ? false
                        : familyChecked === familyKeys.length
                          ? true
                          : 'indeterminate'
                    return (
                      <div
                        key={f}
                        className="rounded-lg border border-border/50 bg-card"
                      >
                        <div className="flex items-center gap-2 px-2 py-2">
                          <Checkbox
                            checked={familyState}
                            onCheckedChange={() => toggleFamily(tree, c, f)}
                            aria-label={`انتخاب گروه ${family.name}`}
                          />
                          <p className="truncate text-sm font-medium">
                            {family.name}
                          </p>
                        </div>
                        <div className="space-y-1 border-t border-border/40 bg-muted/20 p-2">
                          {family.variants.map((variant, v) => (
                            <label
                              key={v}
                              className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-2"
                            >
                              <Checkbox
                                checked={checked.has(variantKey(c, f, v))}
                                onCheckedChange={() => toggleVariant(c, f, v)}
                                aria-label={`انتخاب خدمت ${variant.name}`}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {variant.name}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {toPersianDigits(variant.duration)} دقیقه
                                {variant.price > 0
                                  ? ` · ${toPersianDigits(variant.price.toLocaleString('fa-IR'))} تومان`
                                  : ''}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
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
            const variantTotal = allVariantKeys(preset.tree).length
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
                      {toPersianDigits(preset.tree.length)} دسته ·{' '}
                      {toPersianDigits(variantTotal)} خدمت
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
                    دسته‌های این قالب از قبل در سالن موجود است
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
