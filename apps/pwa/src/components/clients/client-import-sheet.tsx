import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { toast } from '@repo/ui/use-toast'
import {
  buildCanonicalExistingPhones,
  buildClientImportPreview,
  classifyImportContact,
  matchesImportRowSearch,
  parseVcfFile,
  toPreviewSkipReason,
  type ClientImportPreview,
  type ClientImportPreviewRow,
  type ClientImportSkippedRow,
} from '@repo/salon-core'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { Client } from '@repo/salon-core/types'

import {
  FormSheet,
  FormSheetContent,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
} from '#/components/form-sheet'
import {
  ClientImportPreviewList,
  defaultImportPreviewFilter,
  type ImportPreviewFilter,
} from '#/components/clients/client-import-preview-list'
import { getBulkImportSubmitClients } from '#/lib/client-import'
import { formatBulkImportToast } from '#/lib/client-import-toast'
import { useBulkCreateClientsMutation } from '#/lib/clients-queries'

interface ClientImportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingClients: Client[]
  onSuccess: () => void
  pickFileOnOpen?: boolean
  onPickFileConsumed?: () => void
}

export function ClientImportSheet({
  open,
  onOpenChange,
  existingClients,
  onSuccess,
  pickFileOnOpen = false,
  onPickFileConsumed,
}: ClientImportSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ClientImportPreview | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ImportPreviewFilter>('eligible')

  const existingPhones = useMemo(
    () =>
      new Set(
        existingClients
          .map((client) => client.phone)
          .filter((phone): phone is string => Boolean(phone)),
      ),
    [existingClients],
  )

  const canonicalExistingPhones = useMemo(
    () => buildCanonicalExistingPhones(existingPhones),
    [existingPhones],
  )

  const rows = preview?.rows ?? []
  const skippedRows = preview?.skippedRows ?? []
  const counts = preview?.counts ?? null

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesImportRowSearch(row, search)),
    [rows, search],
  )

  const selectAllState = useMemo(() => {
    if (visibleRows.length === 0) return false
    const selected = visibleRows.filter((row) => row.selected).length
    if (selected === 0) return false
    if (selected === visibleRows.length) return true
    return 'indeterminate' as const
  }, [visibleRows])

  const bulkCreate = useBulkCreateClientsMutation()

  const resetPreview = useCallback(() => {
    setPreview(null)
    setSearch('')
    setFilter('eligible')
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    resetPreview()
  }, [onOpenChange, resetPreview])

  const pickFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  useEffect(() => {
    if (!open || !pickFileOnOpen) return
    pickFile()
    onPickFileConsumed?.()
  }, [open, onPickFileConsumed, pickFile, pickFileOnOpen])

  useEffect(() => {
    if (!counts) return
    if (filter === 'eligible' && counts.eligible === 0 && skippedRows.length > 0) {
      setFilter(defaultImportPreviewFilter(counts))
    }
  }, [counts, filter, skippedRows.length])

  const loadFileText = useCallback(
    (text: string) => {
      if (!/BEGIN:VCARD/i.test(text)) {
        toast({
          variant: 'destructive',
          title: 'فایل انتخاب‌شده معتبر نیست',
        })
        return
      }

      const drafts = parseVcfFile(text)
      if (drafts.length === 0) {
        toast({
          variant: 'destructive',
          title: 'فایل مخاطبین خالی است',
        })
        return
      }

      const nextPreview = buildClientImportPreview(drafts, existingPhones)
      setPreview(nextPreview)
      setSearch('')
      setFilter(defaultImportPreviewFilter(nextPreview.counts))
    },
    [existingPhones],
  )

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      void file.text().then(loadFileText).catch(() => {
        toast({
          variant: 'destructive',
          title: 'خواندن فایل انجام نشد',
        })
      })
    },
    [loadFileText],
  )

  const updateRow = useCallback(
    (localId: string, patch: Partial<ClientImportPreviewRow>) => {
      setPreview((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          rows: prev.rows.map((row) =>
            row.localId === localId ? { ...row, ...patch } : row,
          ),
        }
      })
    },
    [],
  )

  const handleRowBlur = useCallback(
    (localId: string) => {
      setPreview((prev) => {
        if (!prev) return prev

        const row = prev.rows.find((item) => item.localId === localId)
        if (!row) return prev

        const others = prev.rows.filter((item) => item.localId !== localId)
        const result = classifyImportContact(row, {
          canonicalExistingPhones,
          siblingContacts: others,
          excludeLocalId: localId,
        })

        if (result.eligible) return prev

        const skipKey = toPreviewSkipReason(result.reason)
        const skippedRow: ClientImportSkippedRow = {
          localId: row.localId,
          name: row.name,
          phone: row.phone,
          reason: result.reason,
          invalidDetail: result.eligible ? undefined : result.invalidDetail,
        }

        return {
          counts: {
            ...prev.counts,
            eligible: Math.max(0, prev.counts.eligible - 1),
            [skipKey]: prev.counts[skipKey] + 1,
          },
          rows: others,
          skippedRows: [...prev.skippedRows, skippedRow],
        }
      })
    },
    [canonicalExistingPhones],
  )

  const toggleSelectAll = useCallback(() => {
    const shouldSelect = selectAllState !== true
    const visibleIds = new Set(visibleRows.map((row) => row.localId))
    setPreview((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        rows: prev.rows.map((row) =>
          visibleIds.has(row.localId) ? { ...row, selected: shouldSelect } : row,
        ),
      }
    })
  }, [selectAllState, visibleRows])

  const handleSubmit = useCallback(async () => {
    const clients = getBulkImportSubmitClients(rows)
    if (clients.length === 0) return

    try {
      const result = await bulkCreate.mutateAsync(clients)
      toast({
        variant: 'success',
        title: formatBulkImportToast(result.created.length, result.skipped),
      })
      onSuccess()
      handleClose()
    } catch {
      // Error toast handled by mutation cache.
    }
  }, [bulkCreate, handleClose, onSuccess, rows])

  const hasPreview = preview != null
  const hasImportContent = rows.length > 0 || skippedRows.length > 0
  const submitCount = useMemo(
    () => getBulkImportSubmitClients(rows).length,
    [rows],
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,text/vcard"
        className="hidden"
        onChange={handleFileChange}
      />

      <FormSheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <FormSheetContent onRequestClose={handleClose}>
          <FormSheetHeader>
            <FormSheetTitle>ورود از فایل مخاطبین</FormSheetTitle>
          </FormSheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-1">
            {hasPreview && counts && hasImportContent ? (
              <ClientImportPreviewList
                counts={counts}
                rows={rows}
                skippedRows={skippedRows}
                search={search}
                onSearchChange={setSearch}
                filter={filter}
                onFilterChange={setFilter}
                onUpdateRow={updateRow}
                onRowBlur={handleRowBlur}
                onToggleSelectAll={toggleSelectAll}
                selectAllState={selectAllState}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {hasPreview
                    ? 'هیچ مخاطب قابل افزودنی در این فایل نیست'
                    : 'یک فایل .vcf از مخاطبین خود انتخاب کنید'}
                </p>
                <Button variant="outline" onClick={pickFile}>
                  {hasPreview ? 'انتخاب فایل دیگر' : 'انتخاب فایل'}
                </Button>
              </div>
            )}
          </div>

          <FormSheetFooter>
            <Button
              onClick={() => void handleSubmit()}
              disabled={bulkCreate.isPending || submitCount === 0}
              className="touch-manipulation"
            >
              {bulkCreate.isPending && <Spinner className="ml-2" />}
              {bulkCreate.isPending
                ? 'در حال افزودن…'
                : `افزودن ${toPersianDigits(submitCount)} مشتری`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={bulkCreate.isPending}
            >
              انصراف
            </Button>
          </FormSheetFooter>
        </FormSheetContent>
      </FormSheet>
    </>
  )
}
