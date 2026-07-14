import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Phone, Plus, Sparkles } from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card } from '@repo/ui/card'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { SearchInput } from '@repo/ui/search-input'
import { cn } from '@repo/ui/utils'
import { displayPhone } from '@repo/salon-core/phone'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { Client } from '@repo/salon-core/types'

import {
  clientsListQueryOptions,
  getApiV1ClientsQueryKey,
} from '#/lib/clients-queries'
import { retentionListQueryOptions } from '#/lib/retention-queries'
import { BulkClientAddSourceDialog } from '#/components/clients/bulk-client-add-source-dialog'
import { ClientDrawer } from '#/components/clients/client-drawer'
import { ClientImportPreviewSheetHost } from '#/components/clients/client-import-preview-sheet-host'
import { isDeviceContactPickerSupported } from '#/lib/device-contacts'
import { useClientImport } from '#/lib/use-client-import'
import {
  ClientAvatar,
  clientAccent,
  isVip,
  tagTone,
} from '#/components/clients/client-visuals'
import { ClientsSkeleton } from '#/components/clients/clients-skeleton'

type FilterId = 'all' | 'vip' | 'followup'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export const Route = createFileRoute('/_authed/clients/')({
  component: ClientsPage,
  pendingComponent: ClientsSkeleton,
  errorComponent: ClientsError,
})

function ClientsError({ error }: { error: Error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        فهرست مشتریان بارگذاری نشد
      </p>
      <p className="text-xs text-destructive">{error.message}</p>
    </div>
  )
}

function InsightCard({
  tone,
  icon: Icon,
  label,
  sub,
  value,
}: {
  tone: 'rose' | 'sky'
  icon: React.ElementType
  label: string
  sub: string
  value: number
}) {
  const toneClass =
    tone === 'rose' ? 'bg-secondary text-plum-deep' : 'bg-sky-soft text-sky-fg'
  return (
    <div className="flex min-w-[150px] items-center gap-2.5 rounded-[18px] border border-line-soft bg-card p-3">
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-2xl',
          toneClass,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-extrabold tracking-tight tabular-nums text-foreground">
          {toPersianDigits(value)}
        </div>
        <div className="text-[11px] font-semibold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  )
}

function ClientsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const devicePickerSupported = isDeviceContactPickerSupported()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showBulkAddSource, setShowBulkAddSource] = useState(false)

  const { data: clients = [], isPending } = useQuery(clientsListQueryOptions())

  const { data: retentionData } = useQuery(retentionListQueryOptions())

  const followUpIds = useMemo(
    () => new Set((retentionData?.items ?? []).map((item) => item.client.id)),
    [retentionData],
  )

  const vipCount = useMemo(() => clients.filter(isVip).length, [clients])
  const followUpCount = useMemo(
    () => clients.filter((client) => followUpIds.has(client.id)).length,
    [clients, followUpIds],
  )
  const newThisWeekCount = useMemo(() => {
    const cutoff = Date.now() - WEEK_MS
    return clients.filter(
      (client) => new Date(client.createdAt).getTime() >= cutoff,
    ).length
  }, [clients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((client) => {
      if (filter === 'vip' && !isVip(client)) return false
      if (filter === 'followup' && !followUpIds.has(client.id)) return false
      if (q) {
        return (
          client.name.toLowerCase().includes(q) ||
          (client.phone ?? '').includes(search.trim())
        )
      }
      return true
    })
  }, [clients, filter, followUpIds, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Client[]>()
    for (const client of filtered) {
      const key = client.name.trim().charAt(0) || '#'
      const list = map.get(key) ?? []
      list.push(client)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa'))
  }, [filtered])

  const chips: Array<{ id: FilterId; label: string; count: number }> = [
    { id: 'all', label: 'همه', count: clients.length },
    { id: 'vip', label: 'VIP', count: vipCount },
    { id: 'followup', label: 'پیگیری', count: followUpCount },
  ]

  const handleAddClient = () => {
    setSelectedClient(null)
    setShowDrawer(true)
  }

  const handleSuccess = () => {
    setShowDrawer(false)
    setSelectedClient(null)
    void queryClient.invalidateQueries({ queryKey: getApiV1ClientsQueryKey() })
  }

  const importFlow = useClientImport({
    existingClients: clients,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1ClientsQueryKey(),
      })
    },
  })

  const handleBulkAddClick = () => {
    if (devicePickerSupported) {
      setShowBulkAddSource(true)
      return
    }
    void navigate({ to: '/clients/import' })
  }

  const handleBulkAddFromContacts = () => {
    void importFlow.pickFromDevice()
  }

  const handleBulkAddFromFile = () => {
    void navigate({ to: '/clients/import' })
  }

  if (isPending) {
    return <ClientsSkeleton />
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <header className="border-b border-line-soft bg-card px-5 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
              مشتریان
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">
                {toPersianDigits(clients.length)}
              </span>{' '}
              مشتری فعال
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleBulkAddClick}
          >
            افزودن گروهی
          </Button>
        </div>

        <SearchInput
          placeholder="جستجوی نام یا شماره…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="mt-3.5 rounded-2xl border-line-soft shadow-none"
          className="text-sm"
        />

        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-0.5 scrollbar-hide">
          {chips.map((chip) => {
            const active = filter === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-line-soft bg-paper-deep text-foreground active:bg-accent/40',
                )}
              >
                {chip.label}
                <span
                  className={cn(
                    'rounded-md px-1.5 text-[10px] font-semibold tabular-nums',
                    active
                      ? 'bg-white/20 text-primary-foreground'
                      : 'bg-card text-muted-foreground',
                  )}
                >
                  {toPersianDigits(chip.count)}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="flex-1 overflow-auto pb-24">
        <div className="flex gap-2.5 overflow-x-auto px-5 pt-4 pb-1 scrollbar-hide">
          <InsightCard
            tone="rose"
            icon={Crown}
            label="VIP"
            sub="مشتری ویژه"
            value={vipCount}
          />
          <InsightCard
            tone="sky"
            icon={Sparkles}
            label="جدید این هفته"
            sub="مشتری تازه"
            value={newThisWeekCount}
          />
        </div>

        <div className="px-5 pb-6 pt-1">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <SakuraMark size={56} color="var(--blush-soft)" />
              <p className="text-sm text-muted-foreground">
                {search || filter !== 'all'
                  ? 'مشتری‌ای یافت نشد'
                  : 'هنوز مشتری‌ای ثبت نشده است'}
              </p>
              {!search && filter === 'all' ? (
                <Button
                  variant="link"
                  onClick={handleAddClient}
                  className="text-primary"
                >
                  اولین مشتری را اضافه کنید
                </Button>
              ) : null}
            </div>
          ) : (
            grouped.map(([letter, list]) => (
              <div key={letter} className="mt-2.5">
                <div className="sticky top-0 z-[1] bg-background px-1 pb-1.5 pt-2 text-[11px] font-bold text-muted-foreground">
                  {letter}
                </div>
                <Card className="gap-0 overflow-hidden py-0">
                  {list.map((client, index) => {
                    const accent = clientAccent(
                      client,
                      followUpIds.has(client.id),
                    )
                    return (
                      <div
                        key={client.id}
                        className={cn(
                          'flex items-center gap-3 px-3.5 py-3',
                          index > 0 && 'border-t border-line-soft',
                        )}
                      >
                        <Link
                          to="/clients/$id"
                          params={{ id: client.id }}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          <ClientAvatar name={client.name} accent={accent} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {client.name}
                            </p>
                            <p
                              className="mt-0.5 truncate text-[11.5px] tabular-nums text-muted-foreground"
                              dir="ltr"
                            >
                              {displayPhone(client.phone)}
                            </p>
                            {client.tags && client.tags.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {client.tags.slice(0, 2).map((tag) => (
                                  <Badge
                                    key={tag.id}
                                    variant={tagTone(tag.label)}
                                  >
                                    {tag.label}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </Link>

                        {client.phone ? (
                          <a
                            href={`tel:${client.phone}`}
                            aria-label={`تماس با ${client.name}`}
                            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush-soft text-primary transition-opacity active:opacity-70"
                          >
                            <Phone className="size-[18px]" />
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
                </Card>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleAddClient}
        aria-label="مشتری جدید"
        className="absolute bottom-5 z-20 flex size-14 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_10px_24px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-transform active:scale-95"
        style={{ insetInlineStart: '1.25rem' }}
      >
        <Plus className="size-6" strokeWidth={2.2} />
      </button>

      <ClientDrawer
        open={showDrawer}
        onOpenChange={setShowDrawer}
        client={selectedClient}
        onSuccess={handleSuccess}
      />

      {devicePickerSupported ? (
        <BulkClientAddSourceDialog
          open={showBulkAddSource}
          onOpenChange={setShowBulkAddSource}
          onPickFromContacts={handleBulkAddFromContacts}
          onPickFromFile={handleBulkAddFromFile}
        />
      ) : null}

      <ClientImportPreviewSheetHost importFlow={importFlow} />
    </div>
  )
}
