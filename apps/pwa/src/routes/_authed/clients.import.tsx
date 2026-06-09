import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@repo/ui/button'
import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { Spinner } from '@repo/ui/spinner'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { ClientImportGuidesAccordion } from '#/components/clients/client-import-guides-accordion'
import { ClientImportPreviewList } from '#/components/clients/client-import-preview-list'
import {
  clientsListQueryOptions,
  getApiV1ClientsQueryKey,
} from '#/lib/clients-queries'
import { useClientImport } from '#/lib/use-client-import'

export const Route = createFileRoute('/_authed/clients/import')({
  component: ClientImportPage,
})

function ClientImportPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: clients = [] } = useQuery(clientsListQueryOptions())

  const importFlow = useClientImport({
    existingClients: clients,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1ClientsQueryKey() })
      navigate({ to: '/clients' })
    },
  })

  const showPreview = importFlow.step === 'preview'

  const handleBack = () => {
    if (importFlow.bulkCreate.isPending) return
    if (showPreview) {
      importFlow.resetPreview()
      return
    }
    navigate({ to: '/clients' })
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-line-soft bg-card px-4 py-3">
        <PageHeaderBackButton
          aria-label="بازگشت"
          onClick={handleBack}
          disabled={importFlow.bulkCreate.isPending}
        />
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-foreground">
            ورود از فایل مخاطبین
          </h1>
          <p className="text-[12px] text-muted-foreground">
            {showPreview
              ? 'پیش‌نمایش و انتخاب مشتریان'
              : 'اول راهنما، بعد انتخاب فایل'}
          </p>
        </div>
      </header>

      <input
        ref={importFlow.fileInputRef}
        type="file"
        accept=".vcf,text/vcard"
        className="hidden"
        onChange={importFlow.handleFileChange}
      />

      {showPreview && importFlow.counts ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-1 pt-3">
            <ClientImportPreviewList
              counts={importFlow.counts}
              rows={importFlow.rows}
              skippedRows={importFlow.skippedRows}
              search={importFlow.search}
              onSearchChange={importFlow.setSearch}
              filter={importFlow.filter}
              onFilterChange={importFlow.setFilter}
              onUpdateRow={importFlow.updateRow}
              onRowBlur={importFlow.handleRowBlur}
              onToggleSelectAll={importFlow.toggleSelectAll}
              selectAllState={importFlow.selectAllState}
            />
          </div>

          <div className="shrink-0 space-y-2 border-t border-line-soft bg-card px-4 py-3 pb-safe">
            <Button
              onClick={() => void importFlow.handleSubmit()}
              disabled={
                importFlow.bulkCreate.isPending || importFlow.submitCount === 0
              }
              className="w-full touch-manipulation"
            >
              {importFlow.bulkCreate.isPending && <Spinner className="ml-2" />}
              {importFlow.bulkCreate.isPending
                ? 'در حال افزودن…'
                : `افزودن ${toPersianDigits(importFlow.submitCount)} مشتری`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={importFlow.resetPreview}
              disabled={importFlow.bulkCreate.isPending}
            >
              بازگشت به راهنما
            </Button>
          </div>
        </div>
      ) : (
        <ClientImportGuidesAccordion onPickFile={importFlow.pickFile} />
      )}
    </div>
  )
}
