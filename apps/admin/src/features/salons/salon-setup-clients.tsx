import {
  getApiV1AdminSalonsByIdClientsQueryKey,
  postApiV1AdminSalonsByIdSetupClientsImportMutation,
  postApiV1AdminSalonsByIdSetupClientsImportPreviewMutation,
  postApiV1AdminSalonsByIdSetupClientsMutation,
} from '@repo/api-client/query'
import type {
  AdminSetupClientImportPreviewResponse,
  AdminSetupClientImportSource,
} from '@repo/api-client/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { FormField, TextAreaField } from '#/components/admin/form-field'
import {
  LiveConfirmationInput,
  LiveDataWarning,
  liveConfirmationFromForm,
} from '#/components/admin/live-data-form'
import { MutationError } from '#/components/admin/mutation-error'
import { Panel } from '#/components/admin/panel'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Spinner } from '#/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

function skipLabel(
  row: AdminSetupClientImportPreviewResponse['skippedRows'][number],
) {
  if (row.reason === 'duplicate-existing') return 'تکراری در سالن'
  if (row.reason === 'duplicate-in-file') return 'تکراری در فایل'
  if (row.invalidDetail === 'name') return 'نام خالی'
  if (row.invalidDetail === 'missing-phone') return 'بدون شماره'
  return 'شماره نامعتبر'
}

export function SalonSetupClients({
  salonId,
  isLiveData,
  overrideMode,
}: {
  salonId: string
  isLiveData: boolean
  overrideMode: boolean
}) {
  const queryClient = useQueryClient()
  const [source, setSource] = useState<AdminSetupClientImportSource | null>(
    null,
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const createMutation = useMutation({
    ...postApiV1AdminSalonsByIdSetupClientsMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsByIdClientsQueryKey({
          path: { id: salonId },
        }),
      })
    },
  })
  const previewMutation = useMutation({
    ...postApiV1AdminSalonsByIdSetupClientsImportPreviewMutation(),
    onSuccess: (preview) => {
      setSelectedIds(new Set(preview.rows.map((row) => row.localId)))
    },
  })
  const importMutation = useMutation({
    ...postApiV1AdminSalonsByIdSetupClientsImportMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsByIdClientsQueryKey({
          path: { id: salonId },
        }),
      })
    },
  })

  function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createMutation.mutate({
      path: { id: salonId },
      body: {
        name: String(form.get('name') ?? ''),
        phone: String(form.get('phone') ?? ''),
        notes: String(form.get('notes') ?? ''),
        tags: [],
        reason: String(form.get('reason') ?? ''),
        liveConfirmation: liveConfirmationFromForm(form, isLiveData),
        ...(overrideMode ? { override: true as const } : {}),
      },
    })
  }

  async function selectFile(file: File | undefined) {
    if (!file) return
    const format = file.name.toLowerCase().endsWith('.vcf') ? 'vcf' : 'csv'
    const nextSource = {
      format,
      source: await file.text(),
      ...(overrideMode ? { override: true as const } : {}),
    } as const
    setSource(nextSource)
    importMutation.reset()
    previewMutation.mutate({ path: { id: salonId }, body: nextSource })
  }

  function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!source) return
    const form = new FormData(event.currentTarget)
    importMutation.mutate({
      path: { id: salonId },
      body: {
        ...source,
        selectedLocalIds: [...selectedIds],
        reason: String(form.get('reason') ?? ''),
        liveConfirmation: liveConfirmationFromForm(form, isLiveData),
      },
    })
  }

  const preview = previewMutation.data

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Panel title="افزودن مشتری" icon={<UserPlus />}>
        <form className="flex flex-col gap-4" onSubmit={submitClient}>
          <LiveDataWarning
            show={isLiveData}
            message="افزودن مشتری روی داده‌های زنده اعمال می‌شود. برای ادامه LIVE را وارد کنید."
          />
          <FieldGroup>
            <FormField label="نام مشتری" name="name" required />
            <FormField
              label="شماره موبایل"
              name="phone"
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              required
            />
            <TextAreaField label="یادداشت" name="notes" rows={2} />
            <TextAreaField
              label="دلیل افزودن"
              name="reason"
              rows={2}
              required
            />
            <LiveConfirmationInput show={isLiveData} />
          </FieldGroup>
          <MutationError error={createMutation.error} />
          {createMutation.isSuccess ? (
            <Alert>
              <AlertTitle>مشتری افزوده شد</AlertTitle>
              <AlertDescription>
                رکورد از بخش عملیات قابل ویرایش است.
              </AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <UserPlus data-icon="inline-start" />
            )}
            افزودن مشتری
          </Button>
        </form>
      </Panel>

      <Panel title="ورود مشتریان از فایل" icon={<FileUp />}>
        <form className="flex flex-col gap-4" onSubmit={submitImport}>
          <LiveDataWarning
            show={isLiveData}
            message="ورود مشتریان روی داده‌های زنده اعمال می‌شود. برای ادامه LIVE را وارد کنید."
          />
          <Field>
            <FieldLabel htmlFor="setup-client-file">فایل CSV یا VCF</FieldLabel>
            <Input
              id="setup-client-file"
              type="file"
              accept=".csv,.vcf,text/csv,text/vcard"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
            <FieldDescription>
              فقط نام و شماره خوانده می‌شود؛ ستون‌های دیگر نادیده گرفته می‌شوند.
              فایل ذخیره نمی‌شود.
            </FieldDescription>
          </Field>
          {previewMutation.isPending ? <Spinner /> : null}
          <MutationError error={previewMutation.error} />
          {preview ? (
            <ImportPreview
              preview={preview}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
            />
          ) : null}
          {preview ? (
            <>
              <TextAreaField
                label="دلیل ورود"
                name="reason"
                rows={2}
                required
              />
              <LiveConfirmationInput show={isLiveData} />
              <MutationError error={importMutation.error} />
              {importMutation.data ? (
                <Alert>
                  <AlertTitle>
                    {importMutation.data.imported} مشتری وارد شد
                  </AlertTitle>
                  <AlertDescription>
                    {importMutation.data.skipped} ردیف رد شد. بازگشت گروهی وجود
                    ندارد؛ رکوردها از مسیر عادی ویرایش می‌شوند.
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                disabled={importMutation.isPending || selectedIds.size === 0}
              >
                {importMutation.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FileUp data-icon="inline-start" />
                )}
                تأیید و ورود {selectedIds.size} مشتری
              </Button>
            </>
          ) : null}
        </form>
      </Panel>
    </div>
  )
}

function ImportPreview({
  preview,
  selectedIds,
  onSelectedIdsChange,
}: {
  preview: AdminSetupClientImportPreviewResponse
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
}) {
  const allSelected =
    preview.rows.length > 0 && selectedIds.size === preview.rows.length
  function toggle(localId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) next.add(localId)
    else next.delete(localId)
    onSelectedIdsChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge>{preview.counts.eligible} قابل ورود</Badge>
        <Badge variant="warning">
          {preview.counts.duplicateExisting + preview.counts.duplicateInFile}{' '}
          تکراری
        </Badge>
        <Badge variant="danger">{preview.counts.invalid} نامعتبر</Badge>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  aria-label="انتخاب همه ردیف‌های معتبر"
                  checked={allSelected}
                  onCheckedChange={(value) =>
                    onSelectedIdsChange(
                      value === true
                        ? new Set(preview.rows.map((row) => row.localId))
                        : new Set(),
                    )
                  }
                />
              </TableHead>
              <TableHead>نام</TableHead>
              <TableHead>شماره</TableHead>
              <TableHead>وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.localId}>
                <TableCell>
                  <Checkbox
                    aria-label={`انتخاب ${row.name}`}
                    checked={selectedIds.has(row.localId)}
                    onCheckedChange={(value) =>
                      toggle(row.localId, value === true)
                    }
                  />
                </TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell dir="ltr">{row.phone}</TableCell>
                <TableCell>
                  <Badge variant="outline">قابل ورود</Badge>
                </TableCell>
              </TableRow>
            ))}
            {preview.skippedRows.map((row) => (
              <TableRow key={row.localId}>
                <TableCell>
                  <Checkbox disabled aria-label="ردیف غیرقابل انتخاب" />
                </TableCell>
                <TableCell>{row.name || '—'}</TableCell>
                <TableCell dir="ltr">{row.phone || '—'}</TableCell>
                <TableCell>
                  <Badge variant="warning">{skipLabel(row)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
