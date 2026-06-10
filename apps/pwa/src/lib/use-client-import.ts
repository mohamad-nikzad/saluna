import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { Client } from '@repo/salon-core/types'

import {
  defaultImportPreviewFilter,
  getBulkImportSubmitClients,
  type ImportPreviewFilter,
} from '#/lib/client-import'
import { pickDeviceContactsForImport } from '#/lib/client-import-device'
import { takeClientImportPreview } from '#/lib/client-import-pending-preview'
import { formatBulkImportToast } from '#/lib/client-import-toast'
import { useBulkCreateClientsMutation } from '#/lib/clients-queries'

export function useClientImport({
  existingClients,
  onSuccess,
}: {
  existingClients: Client[]
  onSuccess: () => void
}) {
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

  const pickFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const applyPreview = useCallback((nextPreview: ClientImportPreview) => {
    setPreview(nextPreview)
    setSearch('')
    setFilter(defaultImportPreviewFilter(nextPreview.counts))
  }, [])

  const pendingPreviewTaken = useRef(false)

  useEffect(() => {
    if (pendingPreviewTaken.current) return
    const pending = takeClientImportPreview()
    if (!pending) return
    pendingPreviewTaken.current = true
    applyPreview(pending)
  }, [applyPreview])

  const pickFromDevice = useCallback(async () => {
    const nextPreview = await pickDeviceContactsForImport(existingPhones)
    if (!nextPreview) return
    applyPreview(nextPreview)
  }, [applyPreview, existingPhones])

  useEffect(() => {
    if (!counts) return
    if (
      filter === 'eligible' &&
      counts.eligible === 0 &&
      skippedRows.length > 0
    ) {
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

      void file
        .text()
        .then(loadFileText)
        .catch(() => {
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
          visibleIds.has(row.localId)
            ? { ...row, selected: shouldSelect }
            : row,
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
      resetPreview()
    } catch {
      // Error toast handled by mutation cache.
    }
  }, [bulkCreate, onSuccess, resetPreview, rows])

  const step = preview != null ? ('preview' as const) : ('guides' as const)
  const submitCount = useMemo(
    () => getBulkImportSubmitClients(rows).length,
    [rows],
  )

  return {
    fileInputRef,
    pickFile,
    pickFromDevice,
    handleFileChange,
    step,
    preview,
    resetPreview,
    search,
    setSearch,
    filter,
    setFilter,
    counts,
    rows,
    skippedRows,
    selectAllState,
    updateRow,
    handleRowBlur,
    toggleSelectAll,
    handleSubmit,
    bulkCreate,
    submitCount,
  }
}
