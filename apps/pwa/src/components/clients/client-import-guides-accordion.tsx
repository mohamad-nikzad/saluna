import { useRef, useState } from 'react'
import { AlertTriangle, ChevronLeft, FileUp } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card } from '@repo/ui/card'
import { SearchInput } from '@repo/ui/search-input'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { BrandIconTile } from '#/components/clients/brand-icon'
import {
  IMPORT_GUIDE_PLATFORMS,
  type ImportGuidePlatform,
} from '#/components/clients/client-import-guides'
import { GuideText } from '#/lib/guide-text'
function GuidePitfalls({ guide }: { guide: ImportGuidePlatform }) {
  if (guide.pitfalls.length === 0) return null
  return (
    <Card className="border-amber-200/70 bg-amber-50 p-3 dark:border-amber-800/80 dark:bg-amber-950/40">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
            نکته مهم
          </p>
          <ul className="mt-1.5 space-y-2 text-[12px] leading-relaxed text-amber-950/90 dark:text-amber-50/90">
            {guide.pitfalls.map((segments, i) => (
              <li key={i}>
                <GuideText segments={segments} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

function OutputBadge({ guide }: { guide: ImportGuidePlatform }) {
  return (
    <p className="text-[12px] text-muted-foreground">
      <span className="font-semibold text-foreground">خروجی: </span>
      <GuideText segments={guide.outputSegments} className="inline" />
    </p>
  )
}

function PickFileFooter({ onPick }: { onPick: () => void }) {
  return (
    <div className="shrink-0 border-t border-line-soft bg-card px-4 py-3 pb-safe">
      <Button className="w-full touch-manipulation" onClick={onPick}>
        <FileUp className="size-4 shrink-0" />
        انتخاب فایل
      </Button>
    </div>
  )
}

function GuideSearchHeader({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (v: string) => void
}) {
  return (
    <div className="shrink-0 px-4 pt-3">
      <SearchInput
        placeholder="جستجوی برند یا سیستم…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        containerClassName="rounded-2xl border-line-soft shadow-none"
        className="text-sm"
      />
      <p className="mt-2 text-[12px] text-muted-foreground">
        یک راهنما را باز کنید، مراحل را روی گوشی انجام دهید، بعد فایل را انتخاب
        کنید.
      </p>
    </div>
  )
}

function GuideRowHeader({
  guide,
  open,
  onToggle,
}: {
  guide: ImportGuidePlatform
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 p-3 text-start active:bg-accent/20"
    >
      <BrandIconTile
        slug={guide.brandSlug}
        title={guide.nameSegments.map((s) => s.text).join('')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <GuideText
            segments={guide.nameSegments}
            className="font-bold text-foreground"
          />
          {guide.notRecommended && (
            <Badge variant="outline" className="text-[10px]">
              غیرتوصیه
            </Badge>
          )}
        </div>
        <GuideText
          segments={guide.subtitleSegments}
          className="mt-0.5 text-[12px] text-muted-foreground"
        />
      </div>
      <ChevronLeft
        className={cn(
          'size-5 shrink-0 text-muted-foreground transition-transform',
          open && 'rotate-90',
        )}
      />
    </button>
  )
}

function StepsInlineList({ guide }: { guide: ImportGuidePlatform }) {
  return (
    <ol className="space-y-3">
      {guide.steps.map((segments, i) => (
        <li
          key={i}
          className="flex gap-2 text-[13px] leading-relaxed text-foreground"
        >
          <span className="shrink-0 font-bold text-primary tabular-nums">
            {toPersianDigits(i + 1)}.
          </span>
          <GuideText segments={segments} className="min-w-0 flex-1" />
        </li>
      ))}
    </ol>
  )
}

function ExpandedGuideBody({ guide }: { guide: ImportGuidePlatform }) {
  return (
    <div className="space-y-3 border-t border-line-soft px-3 pb-3 pt-2">
      <OutputBadge guide={guide} />
      <StepsInlineList guide={guide} />
      <GuidePitfalls guide={guide} />
    </div>
  )
}

export function ClientImportGuidesAccordion({
  onPickFile,
}: {
  onPickFile: () => void
}) {
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const guidesRef = useRef<HTMLDivElement>(null)
  const fileFooterRef = useRef<HTMLDivElement>(null)

  const filtered = IMPORT_GUIDE_PLATFORMS.filter((g) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const blob = [
      g.id,
      g.brandSlug,
      ...g.nameSegments.map((s) => s.text),
      ...g.subtitleSegments.map((s) => s.text),
    ]
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GuideSearchHeader query={query} onQueryChange={setQuery} />
      <div ref={guidesRef} className="flex-1 space-y-2 overflow-auto px-4 py-3">
        {filtered.map((g) => {
          const open = expandedId === g.id
          return (
            <Card
              key={g.id}
              className={cn(
                'overflow-hidden border-line-soft transition-colors',
                open && 'border-primary/30 ring-1 ring-primary/20',
              )}
            >
              <GuideRowHeader
                guide={g}
                open={open}
                onToggle={() => setExpandedId(open ? null : g.id)}
              />
              {open && <ExpandedGuideBody guide={g} />}
            </Card>
          )
        })}
      </div>
      <div ref={fileFooterRef}>
        <PickFileFooter onPick={onPickFile} />
      </div>
    </div>
  )
}
