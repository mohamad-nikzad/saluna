import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { Check, Search, X } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/ui/drawer'
import { useIsTouch } from '@repo/ui/use-mobile'
import { cn } from '@repo/ui/utils'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'

export interface CalendarFilterOption {
  id: string
  label: string
  subtitle?: string
  marker: string
  colorVar?: string
  searchText?: string
}

interface CalendarDrawerFilterProps {
  ariaLabel: string
  triggerLabel: string
  title: string
  description: string
  searchPlaceholder: string
  allLabel: string
  allDescription: string
  allMarker: string
  emptyText: string
  icon: ComponentType<{ className?: string }>
  options: CalendarFilterOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function CalendarDrawerFilter({
  ariaLabel,
  triggerLabel,
  title,
  description,
  searchPlaceholder,
  allLabel,
  allDescription,
  allMarker,
  emptyText,
  icon: Icon,
  options,
  selectedIds,
  onChange,
}: CalendarDrawerFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useKeyboardInset(open)
  const [draftSelectedIds, setDraftSelectedIds] =
    useState<string[]>(selectedIds)
  const searchRef = useRef<HTMLInputElement>(null)
  const isTouch = useIsTouch()

  const selectedCount = selectedIds.length
  const draftAllActive = draftSelectedIds.length === 0
  const draftSelectedCount = draftSelectedIds.length
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) =>
      (option.searchText ?? option.label).toLowerCase().includes(q),
    )
  }, [options, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setDraftSelectedIds(selectedIds)
      return
    }
    setDraftSelectedIds(selectedIds)
    if (!isTouch) {
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open, selectedIds, isTouch])

  const toggleDraftOption = (id: string) => {
    setDraftSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const applyDraft = () => {
    onChange(draftSelectedIds)
    setOpen(false)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
      <DrawerTrigger asChild>
        <button
          type="button"
          dir="rtl"
          aria-label={ariaLabel}
          className={cn(
            'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2 ps-0.5 pe-1.5 text-xs font-bold transition-colors touch-manipulation',
            'border-primary/35 bg-primary/10 text-foreground shadow-sm shadow-primary/5',
            'hover:border-primary/50 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
          )}
        >
          {selectedCount > 0 && (
            <span className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-black leading-none text-primary-foreground ring-2 ring-card">
              {toPersianDigits(selectedCount)}
            </span>
          )}
          <span className="flex size-7 items-center justify-center rounded-full border border-primary/20 bg-primary/15 text-foreground">
            <Icon className="size-4" />
          </span>
          <span className="leading-none">{triggerLabel}</span>
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[88dvh] pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent py-3.5 text-base outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
                aria-label="پاک کردن جستجو"
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent active:bg-accent/80 touch-manipulation"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            <button
              type="button"
              onClick={() => setDraftSelectedIds([])}
              aria-pressed={draftAllActive}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-sm transition-colors touch-manipulation',
                'hover:bg-accent/55 active:bg-accent',
                draftAllActive && 'bg-primary/8 text-primary',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black',
                  draftAllActive
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {allMarker}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{allLabel}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {allDescription}
                </span>
              </span>
              {draftAllActive && (
                <Check className="size-4 shrink-0 text-primary" />
              )}
            </button>

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = draftSelectedIds.includes(option.id)
                const colorVar = option.colorVar ?? 'var(--primary)'
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleDraftOption(option.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'mt-1 flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-sm transition-colors touch-manipulation',
                      'hover:bg-accent/55 active:bg-accent',
                      isSelected && 'bg-primary/8',
                    )}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black"
                      style={{
                        backgroundColor: isSelected
                          ? colorVar
                          : `color-mix(in oklch, ${colorVar} 18%, transparent)`,
                        color: isSelected ? '#fff' : colorVar,
                      }}
                    >
                      {option.marker}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {option.label}
                      </span>
                      {option.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.subtitle}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={applyDraft}
              className="min-h-11 w-full rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/85 touch-manipulation"
            >
              اعمال فیلتر
              {draftSelectedCount > 0
                ? ` (${toPersianDigits(draftSelectedCount)})`
                : ''}
            </button>
            {draftSelectedCount > 0 && (
              <button
                type="button"
                onClick={() => setDraftSelectedIds([])}
                className="mt-2 min-h-10 w-full rounded-2xl border border-line-soft bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-accent active:bg-accent touch-manipulation"
              >
                پاک کردن فیلتر
              </button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
