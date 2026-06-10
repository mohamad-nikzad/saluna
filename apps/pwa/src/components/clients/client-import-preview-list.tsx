import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Card } from '@repo/ui/card'
import { Checkbox } from '@repo/ui/checkbox'
import { Input } from '@repo/ui/input'
import { cn } from '@repo/ui/utils'
import {
  MAX_BULK_CLIENTS,
  matchesImportRowSearch,
  formatImportSkipReasonLabel,
  matchesSkippedRowSearch,
  type ClientImportCounts,
  type ClientImportPreviewRow,
  type ClientImportSkippedRow,
} from '@repo/salon-core'
import { displayPhone, normalizePhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import type { ImportPreviewFilter } from '#/lib/client-import'

type ClientImportPreviewListProps = {
  counts: ClientImportCounts
  rows: ClientImportPreviewRow[]
  skippedRows: ClientImportSkippedRow[]
  search: string
  onSearchChange: (value: string) => void
  filter: ImportPreviewFilter
  onFilterChange: (filter: ImportPreviewFilter) => void
  onUpdateRow: (localId: string, patch: Partial<ClientImportPreviewRow>) => void
  onRowBlur: (localId: string) => void
  onToggleSelectAll: () => void
  selectAllState: boolean | 'indeterminate'
}

export function ClientImportPreviewList({
  counts,
  rows,
  skippedRows,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onUpdateRow,
  onRowBlur,
  onToggleSelectAll,
  selectAllState,
}: ClientImportPreviewListProps) {
  const duplicateCount = counts.duplicateExisting + counts.duplicateInFile
  const skippedCount = skippedRows.length

  const pills = useMemo(() => {
    const all: Array<{
      id: ImportPreviewFilter
      label: string
      count: number
      tone: 'mint' | 'danger' | 'amber' | 'neutral'
    }> = [
      {
        id: 'eligible',
        label: 'قابل افزودن',
        count: counts.eligible,
        tone: 'mint',
      },
    ]

    if (counts.invalid > 0) {
      all.push({
        id: 'invalid',
        label: 'نامعتبر',
        count: counts.invalid,
        tone: 'danger',
      })
    }
    if (duplicateCount > 0) {
      all.push({
        id: 'duplicate',
        label: 'تکراری',
        count: duplicateCount,
        tone: 'amber',
      })
    }
    if (skippedCount > 0) {
      all.push({
        id: 'all-skipped',
        label: 'همه رد شده',
        count: skippedCount,
        tone: 'neutral',
      })
    }

    return all
  }, [counts.eligible, counts.invalid, duplicateCount, skippedCount])

  const visibleEligible = useMemo(
    () => rows.filter((row) => matchesImportRowSearch(row, search)),
    [rows, search],
  )

  const visibleSkipped = useMemo(() => {
    const filtered = skippedRows.filter((row) =>
      matchesSkippedRowSearch(row, search),
    )
    if (filter === 'all-skipped') return filtered
    if (filter === 'invalid') {
      return filtered.filter((row) => row.reason === 'invalid')
    }
    if (filter === 'duplicate') {
      return filtered.filter(
        (row) =>
          row.reason === 'duplicate-existing' ||
          row.reason === 'duplicate-in-file',
      )
    }
    return []
  }, [filter, search, skippedRows])

  const isEligibleView = filter === 'eligible'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-line-soft bg-card pt-4 pb-3">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pills.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => onFilterChange(pill.id)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors',
                filter === pill.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-line-soft bg-card text-foreground',
              )}
            >
              {pill.label}
              <Badge
                variant={filter === pill.id ? 'ghost' : pill.tone}
                className={cn(
                  'text-[10px]',
                  filter === pill.id && 'text-primary-foreground',
                )}
              >
                {toPersianDigits(pill.count)}
              </Badge>
            </button>
          ))}
        </div>

        <div className="relative px-1 py-1.5">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="جستجو نام یا شماره…"
            className="pr-9"
            dir="auto"
          />
        </div>

        {isEligibleView ? (
          <label className="flex min-h-11 items-center justify-end gap-2 text-sm">
            <span>انتخاب همه</span>
            <Checkbox
              checked={selectAllState}
              onCheckedChange={onToggleSelectAll}
              aria-label="انتخاب همه"
            />
          </label>
        ) : null}

        {counts.truncated ? (
          <p className="text-[11px] leading-5 text-muted-foreground">
            فقط {toPersianDigits(MAX_BULK_CLIENTS)} مورد اول قابل افزودن نمایش
            داده شد
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto pt-3 pb-5">
        <Card className="gap-0 overflow-hidden py-0">
          {isEligibleView ? (
            visibleEligible.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                نتیجه‌ای برای جستجو پیدا نشد
              </p>
            ) : (
              visibleEligible.map((row) => (
                <EligibleImportRow
                  key={row.localId}
                  row={row}
                  onUpdate={(patch) => onUpdateRow(row.localId, patch)}
                  onBlur={() => onRowBlur(row.localId)}
                />
              ))
            )
          ) : visibleSkipped.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              موردی در این دسته نیست
            </p>
          ) : (
            visibleSkipped.map((row) => (
              <SkippedImportRow key={row.localId} row={row} />
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

function EligibleImportRow({
  row,
  onUpdate,
  onBlur,
}: {
  row: ClientImportPreviewRow
  onUpdate: (patch: Partial<ClientImportPreviewRow>) => void
  onBlur: () => void
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line-soft px-3 py-3 last:border-b-0">
      <Checkbox
        checked={row.selected}
        onCheckedChange={(checked) => onUpdate({ selected: checked === true })}
        aria-label={`انتخاب ${row.name}`}
        className="mt-2.5"
      />
      <div className="grid min-w-0 flex-1 gap-2">
        <Input
          value={row.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          onBlur={onBlur}
          placeholder="نام"
          aria-label="نام"
          dir="auto"
        />
        <Input
          type="tel"
          value={displayPhone(row.phone)}
          onChange={(event) =>
            onUpdate({ phone: normalizePhone(event.target.value) })
          }
          onBlur={onBlur}
          placeholder="۰۹۱۲…"
          aria-label="شماره تماس"
          dir="ltr"
          className="text-left tabular-nums"
        />
      </div>
    </div>
  )
}

function SkippedImportRow({ row }: { row: ClientImportSkippedRow }) {
  const phoneDisplay = row.phone ? displayPhone(row.phone) : '—'
  const nameDisplay = row.name.trim() || 'بدون نام'
  const badgeVariant =
    row.reason === 'invalid'
      ? 'danger'
      : row.reason === 'duplicate-existing'
        ? 'amber'
        : 'neutral'

  return (
    <div className="flex items-center gap-3 border-b border-line-soft px-3 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground" dir="auto">
          {nameDisplay}
        </p>
        <p
          className="mt-0.5 truncate text-[11.5px] tabular-nums text-muted-foreground/80"
          dir="ltr"
        >
          {phoneDisplay}
        </p>
      </div>
      <Badge variant={badgeVariant} className="shrink-0 text-[10px]">
        {formatImportSkipReasonLabel(row)}
      </Badge>
    </div>
  )
}
