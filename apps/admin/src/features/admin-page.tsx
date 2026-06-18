import {
  getApiV1AdminAuditLogOptions,
  getApiV1AdminCatalogPresetsOptions,
  getApiV1AdminCatalogPresetsQueryKey,
  getApiV1AdminMessagingHealthOptions,
  getApiV1AdminNotificationsDeliveriesOptions,
  getApiV1AdminOverviewQueryKey,
  getApiV1AdminPlatformAdminsOptions,
  getApiV1AdminPlatformAdminsQueryKey,
  getApiV1AdminSalonsByIdNotesOptions,
  getApiV1AdminSalonsByIdNotesQueryKey,
  getApiV1AdminSalonsByIdOptions,
  getApiV1AdminSalonsByIdQueryKey,
  getApiV1AdminSalonsOptions,
  getApiV1AdminSalonsQueryKey,
  getApiV1AdminSupportAppointmentRequestsOptions,
  getApiV1AdminSupportAppointmentsOptions,
  getApiV1AdminUsersByIdNotesOptions,
  getApiV1AdminUsersByIdOptions,
  getApiV1AdminUsersOptions,
  patchApiV1AdminCatalogPresetsByIdMutation,
  patchApiV1AdminPlatformAdminsByIdMutation,
  patchApiV1AdminSalonsByIdStatusMutation,
  postApiV1AdminCatalogPresetsMutation,
  postApiV1AdminPlatformAdminsMutation,
  postApiV1AdminSalonsByIdNotesMutation,
  postApiV1AdminUsersByIdNotesMutation,
} from '@repo/api-client/query'
import type {
  AdminSalonStatus,
  PlatformRole,
} from '@repo/api-client/types'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  BellRing,
  CircleAlert,
  Eye,
  LockKeyhole,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Skeleton } from '#/components/ui/skeleton'
import { useAdminAuth } from '#/context/admin-auth-provider'
import { useTableUrlState } from '#/hooks/use-table-url-state'
import { cn } from '#/lib/utils'

type AdminPageId =
  | 'salons'
  | 'users'
  | 'catalog-presets'
  | 'messaging-health'
  | 'support-lookup'
  | 'audit-log'
  | 'platform-admins'
  | 'settings'

type RecordRow = Record<string, unknown>

type ListParams = {
  page: number
  pageSize: number
  search?: string
}

type ListResult = {
  items: RecordRow[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

type AdminListQueryOptions = UseQueryOptions<
  ListResult,
  unknown,
  ListResult,
  readonly unknown[]
>

type PageConfig = {
  title: string
  description: string
}

const pageConfig: Record<AdminPageId, PageConfig> = {
  salons: {
    title: 'سالن‌ها',
    description: 'بررسی سالن‌ها، یادداشت‌های داخلی و کنترل وضعیت پلتفرمی.',
  },
  users: {
    title: 'کاربران',
    description:
      'جستجوی حساب‌ها، عضویت‌ها، حساب‌های پیام‌رسانی و یادداشت‌های پشتیبانی.',
  },
  'catalog-presets': {
    title: 'قالب‌های کاتالوگ',
    description: 'ساخت، ویرایش، آرشیو و مرتب‌سازی قالب‌های کاتالوگ خدمات.',
  },
  'messaging-health': {
    title: 'سلامت پیام‌رسانی',
    description:
      'وضعیت ارائه‌دهنده‌ها، ارسال‌های ناموفق، پیگیری‌های ناموفق و حساب‌های متصل.',
  },
  'support-lookup': {
    title: 'جستجوی پشتیبانی',
    description:
      'جستجوی فقط‌خواندنی نوبت‌ها و درخواست‌های نوبت در همه سالن‌ها.',
  },
  'audit-log': {
    title: 'لاگ ممیزی',
    description:
      'تاریخچه تغییرات ادمین همراه با انجام‌دهنده، هدف، دلیل و زمینه درخواست.',
  },
  'platform-admins': {
    title: 'ادمین‌های پلتفرم',
    description: 'اعطا، تغییر و لغو دسترسی داخلی با محافظت از آخرین مالک.',
  },
  settings: {
    title: 'تنظیمات',
    description: 'تنظیمات داخلی ادمین که رفتار سالن‌ها را تغییر نمی‌دهد.',
  },
}

export function AdminPage({ pageId }: { pageId: AdminPageId }) {
  const config = pageConfig[pageId]

  return (
    <>
      <AdminPageHeader
        title={config.title}
        description={config.description}
        actions={<HeaderAction pageId={pageId} />}
      />
      {pageId === 'salons' ? <SalonsScreen /> : null}
      {pageId === 'users' ? <UsersScreen /> : null}
      {pageId === 'catalog-presets' ? <CatalogPresetsScreen /> : null}
      {pageId === 'messaging-health' ? <MessagingHealthScreen /> : null}
      {pageId === 'support-lookup' ? <SupportLookupScreen /> : null}
      {pageId === 'audit-log' ? <AuditLogScreen /> : null}
      {pageId === 'platform-admins' ? <PlatformAdminsScreen /> : null}
      {pageId === 'settings' ? <SettingsScreen /> : null}
    </>
  )
}

function HeaderAction({ pageId }: { pageId: AdminPageId }) {
  if (pageId === 'catalog-presets') return null
  if (pageId === 'platform-admins') return null
  return null
}

function SalonsScreen() {
  const [selected, setSelected] = useState<RecordRow | null>(null)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'سالن',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={text(row.original.slug)}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => <StatusBadge status={text(row.original.status)} />,
      },
      {
        accessorKey: 'phone',
        header: 'موبایل',
        cell: ({ row }) => <span dir="ltr">{text(row.original.phone)}</span>,
      },
      {
        accessorKey: 'memberCount',
        header: 'اعضا',
        cell: ({ row }) => number(row.original.memberCount),
      },
      {
        accessorKey: 'publicEnabled',
        header: 'صفحه عمومی',
        cell: ({ row }) => (
          <BooleanBadge value={truthy(row.original.publicEnabled)} />
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <RowButton onClick={() => setSelected(row.original)} />
        ),
      },
    ],
    [],
  )

  return (
    <>
      <AdminListTable
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminSalonsOptions({ query: params })
        }
        searchPlaceholder="جستجو بر اساس نام سالن، اسلاگ یا شماره موبایل..."
      />
      <SalonSheet
        row={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  )
}

function SalonSheet({
  row,
  onOpenChange,
}: {
  row: RecordRow | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { runtime } = useAdminAuth()
  const isLiveData = runtime.dataSource === 'live'
  const id = text(row?.id)
  const detailQuery = useQuery({
    ...getApiV1AdminSalonsByIdOptions({ path: { id } }),
    enabled: Boolean(id),
  })
  const notesQuery = useQuery({
    ...getApiV1AdminSalonsByIdNotesOptions({ path: { id } }),
    enabled: Boolean(id),
  })
  const statusMutation = useMutation({
    ...patchApiV1AdminSalonsByIdStatusMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsQueryKey(),
      })
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsByIdQueryKey({ path: { id } }),
      })
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminOverviewQueryKey(),
      })
    },
  })
  const noteMutation = useMutation({
    ...postApiV1AdminSalonsByIdNotesMutation(),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsByIdNotesQueryKey({ path: { id } }),
      }),
  })
  const salon = detailQuery.data?.salon ?? row ?? {}

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{text(salon.name) || 'جزئیات سالن'}</SheetTitle>
          <SheetDescription>
            {text(salon.slug) || text(salon.id)}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {detailQuery.isLoading ? <ScreenSkeleton /> : null}
          <DetailGrid
            items={[
              [
                'وضعیت',
                <StatusBadge key="status" status={text(salon.status)} />,
              ],
              ['موبایل', text(salon.phone)],
              ['منطقه زمانی', text(salon.timezone)],
              ['صفحه عمومی', truthy(salon.publicEnabled) ? 'فعال' : 'غیرفعال'],
              ['خدمات', number(detailQuery.data?.stats.services)],
              ['نوبت‌ها', number(detailQuery.data?.stats.appointments)],
            ]}
          />
          <StatusForm
            current={text(salon.status) as AdminSalonStatus}
            isLiveData={isLiveData}
            pending={statusMutation.isPending}
            onSubmit={(input) =>
              statusMutation.mutate({ path: { id }, body: input })
            }
          />
          <Panel title="اعضا">
            <CompactRows
              rows={(detailQuery.data?.members ?? []).map((member) => ({
                label: text(member.name),
                value: text(member.role),
                badge: text(member.phoneNumber) || text(member.email),
              }))}
              empty="عضوی پیدا نشد."
            />
          </Panel>
          <NotesPanel
            notes={notesQuery.data?.notes ?? []}
            pending={noteMutation.isPending}
            onSubmit={(input) =>
              noteMutation.mutate({ path: { id }, body: input })
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function UsersScreen() {
  const [selected, setSelected] = useState<RecordRow | null>(null)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'کاربر',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={
              text(row.original.email) || text(row.original.phoneNumber)
            }
          />
        ),
      },
      {
        accessorKey: 'platformRole',
        header: 'نقش پلتفرمی',
        cell: ({ row }) => (
          <RoleBadge
            role={text(row.original.platformRole)}
            active={truthy(row.original.platformActive)}
          />
        ),
      },
      {
        accessorKey: 'salonMembershipCount',
        header: 'سالن‌ها',
        cell: ({ row }) => number(row.original.salonMembershipCount),
      },
      {
        accessorKey: 'createdAt',
        header: 'ساخته‌شده',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <RowButton onClick={() => setSelected(row.original)} />
        ),
      },
    ],
    [],
  )

  return (
    <>
      <AdminListTable
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminUsersOptions({ query: params })
        }
        searchPlaceholder="جستجو بر اساس نام، ایمیل، موبایل یا نام کاربری..."
      />
      <UserSheet
        row={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  )
}

function UserSheet({
  row,
  onOpenChange,
}: {
  row: RecordRow | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const id = text(row?.id)
  const detailQuery = useQuery({
    ...getApiV1AdminUsersByIdOptions({ path: { id } }),
    enabled: Boolean(id),
  })
  const notesQuery = useQuery({
    ...getApiV1AdminUsersByIdNotesOptions({ path: { id } }),
    enabled: Boolean(id),
  })
  const noteMutation = useMutation({
    ...postApiV1AdminUsersByIdNotesMutation(),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminUsersByIdNotesOptions({ path: { id } })
          .queryKey,
      }),
  })
  const user = detailQuery.data?.user ?? row ?? {}

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{text(user.name) || 'جزئیات کاربر'}</SheetTitle>
          <SheetDescription>
            {text(user.email) || text(user.phoneNumber) || text(user.id)}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <DetailGrid
            items={[
              ['موبایل', text(user.phoneNumber)],
              ['نام کاربری', text(user.username)],
              [
                'نقش پلتفرمی',
                <RoleBadge
                  key="role"
                  role={text(user.platformRole)}
                  active={truthy(user.platformActive)}
                />,
              ],
              ['ساخته‌شده', formatDate(user.createdAt)],
              ['به‌روزشده', formatDate(user.updatedAt)],
            ]}
          />
          <Panel title="عضویت‌ها">
            <CompactRows
              rows={(detailQuery.data?.memberships ?? []).map((membership) => ({
                label: text(membership.salonName),
                value: text(membership.role),
                badge: text(membership.salonStatus),
              }))}
              empty="عضویت سالنی پیدا نشد."
            />
          </Panel>
          <Panel title="حساب‌های پیام‌رسانی">
            <CompactRows
              rows={(detailQuery.data?.messagingAccounts ?? []).map(
                (account) => ({
                  label: text(account.provider),
                  value: truthy(account.enabled) ? 'فعال' : 'غیرفعال',
                  badge: text(account.displayName) || text(account.externalId),
                }),
              )}
              empty="حساب پیام‌رسانی متصل نیست."
            />
          </Panel>
          <NotesPanel
            notes={notesQuery.data?.notes ?? []}
            pending={noteMutation.isPending}
            onSubmit={(input) =>
              noteMutation.mutate({ path: { id }, body: input })
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CatalogPresetsScreen() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<RecordRow | null | 'new'>(null)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'قالب',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={text(row.original.slug)}
          />
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'وضعیت',
        cell: ({ row }) => (
          <BooleanBadge
            value={truthy(row.original.isActive)}
            trueLabel="فعال"
            falseLabel="آرشیوشده"
          />
        ),
      },
      {
        accessorKey: 'sortOrder',
        header: 'ترتیب',
        cell: ({ row }) => number(row.original.sortOrder),
      },
      {
        accessorKey: 'tree',
        header: 'درخت',
        cell: ({ row }) =>
          `${Array.isArray(row.original.tree) ? row.original.tree.length : 0} دسته`,
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <RowButton
            label="ویرایش"
            icon={<Save className="h-4 w-4" />}
            onClick={() => setEditing(row.original)}
          />
        ),
      },
    ],
    [],
  )

  return (
    <>
      <AdminListTable
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminCatalogPresetsOptions({ query: params })
        }
        searchPlaceholder="جستجو در قالب‌های کاتالوگ..."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            قالب جدید
          </Button>
        }
      />
      <CatalogPresetSheet
        preset={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() =>
          void queryClient.invalidateQueries({
            queryKey: getApiV1AdminCatalogPresetsQueryKey(),
          })
        }
      />
    </>
  )
}

function CatalogPresetSheet({
  preset,
  onOpenChange,
  onSaved,
}: {
  preset: RecordRow | null | 'new'
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const isNew = preset === 'new'
  const source = preset && preset !== 'new' ? preset : {}
  const createMutation = useMutation({
    ...postApiV1AdminCatalogPresetsMutation(),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })
  const updateMutation = useMutation({
    ...patchApiV1AdminCatalogPresetsByIdMutation(),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })
  const activeMutation = isNew ? createMutation : updateMutation

  return (
    <Sheet open={Boolean(preset)} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isNew ? 'قالب کاتالوگ جدید' : 'ویرایش قالب کاتالوگ'}
          </SheetTitle>
          <SheetDescription>
            ساختار JSON باید با schema قالب کاتالوگ فعلی هم‌خوان باشد.
          </SheetDescription>
        </SheetHeader>
        <CatalogPresetForm
          source={source}
          pending={activeMutation.isPending}
          error={activeMutation.error}
          onSubmit={(input) => {
            if (isNew) {
              createMutation.mutate({ body: input })
              return
            }
            updateMutation.mutate({
              path: { id: text(source.id) },
              body: input,
            })
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

function CatalogPresetForm({
  source,
  pending,
  error,
  onSubmit,
}: {
  source: RecordRow
  pending: boolean
  error: unknown
  onSubmit: (input: {
    slug: string
    name: string
    description: string | null
    tree: RecordRow[]
    sortOrder: number
    isActive: boolean
    reason: string
  }) => void
}) {
  const [treeError, setTreeError] = useState('')
  const treeValue = JSON.stringify(
    Array.isArray(source.tree) ? source.tree : [{ name: '', families: [] }],
    null,
    2,
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const parsed = JSON.parse(String(form.get('tree') ?? '[]')) as RecordRow[]
      if (!Array.isArray(parsed)) throw new Error('درخت باید آرایه باشد')
      setTreeError('')
      onSubmit({
        slug: String(form.get('slug') ?? ''),
        name: String(form.get('name') ?? ''),
        description: String(form.get('description') || '') || null,
        tree: parsed,
        sortOrder: Number(form.get('sortOrder') ?? 0),
        isActive: form.get('isActive') === 'on',
        reason: String(form.get('reason') ?? ''),
      })
    } catch (caught) {
      setTreeError(
        caught instanceof Error ? caught.message : 'JSON نامعتبر است',
      )
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <FormField
        label="اسلاگ"
        name="slug"
        defaultValue={text(source.slug)}
        required
      />
      <FormField
        label="نام"
        name="name"
        defaultValue={text(source.name)}
        required
      />
      <FormField
        label="توضیحات"
        name="description"
        defaultValue={text(source.description)}
      />
      <FormField
        label="ترتیب نمایش"
        name="sortOrder"
        type="number"
        defaultValue={String(number(source.sortOrder))}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={source.isActive !== false}
        />
        فعال
      </label>
      <TextAreaField
        label="ویرایشگر درخت"
        name="tree"
        defaultValue={treeValue}
        rows={12}
      />
      {treeError ? (
        <p className="text-sm text-destructive">{treeError}</p>
      ) : null}
      <TextAreaField
        label="دلیل"
        name="reason"
        placeholder="دلیل الزامی برای ممیزی"
        rows={3}
        required
      />
      <MutationError error={error} />
      <Button disabled={pending} type="submit">
        <Save className="h-4 w-4" />
        ذخیره قالب
      </Button>
    </form>
  )
}

function MessagingHealthScreen() {
  const healthQuery = useQuery(getApiV1AdminMessagingHealthOptions())
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'اعلان',
        cell: ({ row }) => (
          <PrimaryCell
            title={
              text(row.original.title) || text(row.original.notificationType)
            }
            subtitle={text(row.original.error)}
          />
        ),
      },
      {
        accessorKey: 'channel',
        header: 'کانال',
        cell: ({ row }) => text(row.original.channel),
      },
      {
        accessorKey: 'provider',
        header: 'ارائه‌دهنده',
        cell: ({ row }) => text(row.original.provider),
      },
      {
        accessorKey: 'status',
        header: 'وضعیت',
        cell: ({ row }) => (
          <Badge variant="danger">{text(row.original.status)}</Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'ساخته‌شده',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Linked accounts"
          icon={<ShieldCheck className="h-4 w-4" />}
        >
          <CompactRows
            rows={(healthQuery.data?.accounts ?? []).map((row) => ({
              label: text(row.provider),
              value: String(number(row.value)),
              badge: truthy(row.enabled) ? 'فعال' : 'غیرفعال',
            }))}
            empty="حساب متصلی وجود ندارد."
          />
        </Panel>
        <Panel title="اعلان‌های ناموفق" icon={<BellRing className="h-4 w-4" />}>
          <CompactRows
            rows={(healthQuery.data?.failedNotifications ?? []).map((row) => ({
              label: text(row.channel),
              value: String(number(row.value)),
              badge: text(row.provider),
            }))}
            empty="اعلان ناموفقی وجود ندارد."
          />
        </Panel>
        <Panel
          title="پیگیری‌های ناموفق"
          icon={<MessageSquareWarning className="h-4 w-4" />}
        >
          <CompactRows
            rows={(healthQuery.data?.failedFollowUps ?? []).map((row) => ({
              label: text(row.provider),
              value: String(number(row.value)),
            }))}
            empty="پیگیری ناموفقی وجود ندارد."
          />
        </Panel>
      </section>
      <AdminListTable
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminNotificationsDeliveriesOptions({ query: params })
        }
        searchPlaceholder="جستجو در آخرین ارسال‌های اعلان..."
      />
    </div>
  )
}

function SupportLookupScreen() {
  const [kind, setKind] = useState<'appointments' | 'requests'>('appointments')
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () =>
      kind === 'appointments'
        ? [
            {
              accessorKey: 'clientName',
              header: 'مشتری',
              cell: ({ row }) => (
                <PrimaryCell
                  title={text(row.original.clientName)}
                  subtitle={text(row.original.clientPhone)}
                />
              ),
            },
            {
              accessorKey: 'salonName',
              header: 'سالن',
              cell: ({ row }) => text(row.original.salonName),
            },
            {
              accessorKey: 'bookedServiceName',
              header: 'خدمت',
              cell: ({ row }) => text(row.original.bookedServiceName),
            },
            {
              accessorKey: 'date',
              header: 'تاریخ',
              cell: ({ row }) =>
                `${text(row.original.date)} ${text(row.original.startTime)}`,
            },
            {
              accessorKey: 'status',
              header: 'وضعیت',
              cell: ({ row }) => <Badge>{text(row.original.status)}</Badge>,
            },
          ]
        : [
            {
              accessorKey: 'customerName',
              header: 'مشتری',
              cell: ({ row }) => (
                <PrimaryCell
                  title={text(row.original.customerName)}
                  subtitle={text(row.original.customerPhone)}
                />
              ),
            },
            {
              accessorKey: 'salonName',
              header: 'سالن',
              cell: ({ row }) => text(row.original.salonName),
            },
            {
              accessorKey: 'bookedServiceName',
              header: 'خدمت',
              cell: ({ row }) => text(row.original.bookedServiceName),
            },
            {
              accessorKey: 'requestedDate',
              header: 'درخواست‌شده',
              cell: ({ row }) =>
                `${text(row.original.requestedDate)} ${text(row.original.requestedStartTime)}`,
            },
            {
              accessorKey: 'status',
              header: 'وضعیت',
              cell: ({ row }) => <Badge>{text(row.original.status)}</Badge>,
            },
          ],
    [kind],
  )

  return (
    <div className="space-y-3">
      <div className="flex w-fit rounded-md border border-border p-1">
        <Button
          size="sm"
          variant={kind === 'appointments' ? 'secondary' : 'ghost'}
          onClick={() => setKind('appointments')}
        >
          نوبت‌ها
        </Button>
        <Button
          size="sm"
          variant={kind === 'requests' ? 'secondary' : 'ghost'}
          onClick={() => setKind('requests')}
        >
          درخواست‌ها
        </Button>
      </div>
      <AdminListTable
        key={kind}
        columns={columns}
        queryOptionsFor={(params) =>
          kind === 'appointments'
            ? getApiV1AdminSupportAppointmentsOptions({ query: params })
            : getApiV1AdminSupportAppointmentRequestsOptions({
                query: params,
              })
        }
        searchPlaceholder="جستجو بر اساس مشتری، موبایل یا خدمت..."
      />
    </div>
  )
}

function AuditLogScreen() {
  const [filters, setFilters] = useState({
    action: '',
    targetType: '',
    targetId: '',
    salonId: '',
  })
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'action',
        header: 'عملیات',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.action)}
            subtitle={text(row.original.reason)}
          />
        ),
      },
      {
        accessorKey: 'actorName',
        header: 'انجام‌دهنده',
        cell: ({ row }) => (
          <RoleBadge role={text(row.original.actorPlatformRole)} active />
        ),
      },
      {
        accessorKey: 'targetType',
        header: 'هدف',
        cell: ({ row }) =>
          `${text(row.original.targetType)} ${shortId(row.original.targetId)}`,
      },
      {
        accessorKey: 'ip',
        header: 'IP',
        cell: ({ row }) => <span dir="ltr">{text(row.original.ip)}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'ساخته‌شده',
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-4">
        {(['action', 'targetType', 'targetId', 'salonId'] as const).map(
          (field) => (
            <Input
              key={field}
              value={filters[field]}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
              placeholder={field}
            />
          ),
        )}
      </div>
      <AdminListTable
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminAuditLogOptions({ query: { ...params, ...filters } })
        }
        searchPlaceholder="برای فیلتر دقیق لاگ ممیزی از فیلدهای بالا استفاده کنید."
      />
    </div>
  )
}

function PlatformAdminsScreen() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<RecordRow | null | 'new'>(null)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'ادمین',
        cell: ({ row }) => (
          <PrimaryCell
            title={text(row.original.name)}
            subtitle={
              text(row.original.email) || text(row.original.phoneNumber)
            }
          />
        ),
      },
      {
        accessorKey: 'role',
        header: 'نقش',
        cell: ({ row }) => (
          <RoleBadge
            role={text(row.original.role)}
            active={truthy(row.original.active)}
          />
        ),
      },
      {
        accessorKey: 'active',
        header: 'دسترسی',
        cell: ({ row }) => (
          <BooleanBadge
            value={truthy(row.original.active)}
            trueLabel="فعال"
            falseLabel="لغوشده"
          />
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'به‌روزشده',
        cell: ({ row }) => formatDate(row.original.updatedAt),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <RowButton label="مدیریت" onClick={() => setSelected(row.original)} />
        ),
      },
    ],
    [],
  )

  return (
    <>
      <AdminListTable
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminPlatformAdminsOptions({ query: params })
        }
        searchPlaceholder="جستجو بر اساس نام، ایمیل، موبایل یا نام کاربری..."
        actions={
          <Button size="sm" onClick={() => setSelected('new')}>
            <Plus className="h-4 w-4" />
            اعطای دسترسی
          </Button>
        }
      />
      <PlatformAdminSheet
        admin={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onSaved={() =>
          void queryClient.invalidateQueries({
            queryKey: getApiV1AdminPlatformAdminsQueryKey(),
          })
        }
      />
    </>
  )
}

function PlatformAdminSheet({
  admin,
  onOpenChange,
  onSaved,
}: {
  admin: RecordRow | null | 'new'
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const isNew = admin === 'new'
  const { runtime } = useAdminAuth()
  const isLiveData = runtime.dataSource === 'live'
  const source = admin && admin !== 'new' ? admin : {}
  const createMutation = useMutation({
    ...postApiV1AdminPlatformAdminsMutation(),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })
  const updateMutation = useMutation({
    ...patchApiV1AdminPlatformAdminsByIdMutation(),
    onSuccess: () => {
      onSaved()
      onOpenChange(false)
    },
  })
  const activeMutation = isNew ? createMutation : updateMutation

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      userId: String(form.get('userId') ?? ''),
      role: String(form.get('role') ?? 'platform_viewer') as PlatformRole,
      active: form.get('active') === 'on',
      reason: String(form.get('reason') ?? ''),
      liveConfirmation: liveConfirmationFromForm(form, isLiveData),
    }
    if (isNew) {
      createMutation.mutate({ body })
      return
    }
    updateMutation.mutate({
      path: { id: text(source.id) },
      body: {
        role: body.role,
        active: body.active,
        reason: body.reason,
        liveConfirmation: body.liveConfirmation,
      },
    })
  }

  return (
    <Sheet open={Boolean(admin)} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isNew ? 'اعطای دسترسی پلتفرم' : 'مدیریت ادمین پلتفرم'}
          </SheetTitle>
          <SheetDescription>
            محافظت از آخرین مالک فعال در API اعمال می‌شود.
          </SheetDescription>
        </SheetHeader>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <LiveDataWarning
            show={isLiveData}
            message="این تغییر دسترسی ادمین روی داده زنده تولید اعمال می‌شود."
          />
          <FormField
            label="شناسه کاربر"
            name="userId"
            defaultValue={text(source.userId)}
            required
            readOnly={!isNew}
          />
          <SelectField
            label="نقش"
            name="role"
            defaultValue={text(source.role) || 'platform_viewer'}
            options={roleOptions}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              name="active"
              type="checkbox"
              defaultChecked={source.active !== false}
            />
            دسترسی فعال
          </label>
          <TextAreaField label="دلیل" name="reason" rows={3} required />
          <LiveConfirmationInput show={isLiveData} />
          <MutationError error={activeMutation.error} />
          <Button disabled={activeMutation.isPending} type="submit">
            <ShieldCheck className="h-4 w-4" />
            ذخیره دسترسی
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function SettingsScreen() {
  const { me } = useAdminAuth()
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel title="نشست" icon={<UserRound className="h-4 w-4" />}>
        <DetailGrid
          items={[
            ['Name', me.name],
            ['ایمیل', me.email],
            ['موبایل', me.phoneNumber],
            ['نقش', <RoleBadge key="role" role={me.role} active={me.active} />],
          ]}
        />
      </Panel>
      <Panel title="مدل دسترسی" icon={<LockKeyhole className="h-4 w-4" />}>
        <p className="text-sm leading-6 text-muted-foreground">
          دسترسی ادمین با نقش‌های پلتفرمی و نشست کوکی Better Auth کنترل می‌شود.
        </p>
      </Panel>
    </section>
  )
}

function AdminListTable({
  columns,
  queryOptionsFor,
  searchPlaceholder,
  actions,
}: {
  columns: ColumnDef<RecordRow>[]
  queryOptionsFor: (params: ListParams) => unknown
  searchPlaceholder: string
  actions?: ReactNode
}) {
  const [tableState, setTableState] = useTableUrlState(20)
  const pagination: PaginationState = {
    pageIndex: Math.max(tableState.page - 1, 0),
    pageSize: tableState.pageSize,
  }
  const listQuery = useQuery(
    queryOptionsFor({
      page: tableState.page,
      pageSize: tableState.pageSize,
      search: tableState.query || undefined,
    }) as AdminListQueryOptions,
  )
  const total = listQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / tableState.pageSize))

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <DataTableToolbar
          query={tableState.query}
          onQueryChange={(query) => setTableState({ query, page: 1 })}
          onReset={() => setTableState({ query: '', page: 1, sort: '' })}
        />
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <p className="text-xs text-muted-foreground">{searchPlaceholder}</p>
      {listQuery.isLoading ? <ScreenSkeleton /> : null}
      {listQuery.isError ? (
        <ErrorPanel message="بارگذاری رکوردهای ادمین انجام نشد." />
      ) : null}
      <DataTable
        columns={columns}
        data={listQuery.data?.items ?? []}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={(next) =>
          setTableState({ page: next.pageIndex + 1, pageSize: next.pageSize })
        }
      />
      <DataTablePagination
        pagination={pagination}
        pageCount={pageCount}
        onPaginationChange={(next) =>
          setTableState({ page: next.pageIndex + 1, pageSize: next.pageSize })
        }
      />
    </section>
  )
}

function StatusForm({
  current,
  isLiveData,
  pending,
  onSubmit,
}: {
  current: AdminSalonStatus
  isLiveData: boolean
  pending: boolean
  onSubmit: (input: {
    status: AdminSalonStatus
    reason: string
    liveConfirmation?: string
  }) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit({
      status: String(form.get('status') ?? current) as AdminSalonStatus,
      reason: String(form.get('reason') ?? ''),
      liveConfirmation: liveConfirmationFromForm(form, isLiveData),
    })
    event.currentTarget.reset()
  }

  return (
    <Panel title="کنترل وضعیت">
      <form className="space-y-3" onSubmit={submit}>
        <LiveDataWarning
          show={isLiveData}
          message="تغییر وضعیت سالن روی داده زنده تولید اعمال می‌شود."
        />
        <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
          <SelectField
            label="وضعیت"
            name="status"
            defaultValue={current || 'active'}
            options={[
              ['active', 'فعال'],
              ['suspended', 'تعلیق‌شده'],
              ['archived', 'آرشیوشده'],
            ]}
            hideLabel
          />
          <Input name="reason" placeholder="دلیل الزامی" required />
          <Button type="submit" disabled={pending}>
            <RefreshCw className="h-4 w-4" />
            به‌روزرسانی
          </Button>
        </div>
        <LiveConfirmationInput show={isLiveData} />
      </form>
    </Panel>
  )
}

function liveConfirmationFromForm(form: FormData, isLiveData: boolean) {
  if (!isLiveData) return undefined
  return String(form.get('liveConfirmation') ?? '')
}

function LiveDataWarning({
  show,
  message,
}: {
  show: boolean
  message: string
}) {
  if (!show) return null
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="leading-6">{message} برای ادامه عبارت LIVE را وارد کنید.</p>
    </div>
  )
}

function LiveConfirmationInput({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <FormField
      label="تأیید داده زنده"
      name="liveConfirmation"
      placeholder="LIVE"
      pattern="LIVE"
      required
    />
  )
}

function NotesPanel({
  notes,
  pending,
  onSubmit,
}: {
  notes: Array<{ body: string; authorName: string; createdAt: string }>
  pending: boolean
  onSubmit: (input: { body: string; reason: string }) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit({
      body: String(form.get('body') ?? ''),
      reason: String(form.get('reason') ?? ''),
    })
    event.currentTarget.reset()
  }

  return (
    <Panel title="یادداشت‌های داخلی">
      <form className="space-y-3" onSubmit={submit}>
        <TextAreaField label="یادداشت" name="body" rows={3} required />
        <Input name="reason" placeholder="دلیل الزامی برای ممیزی" required />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          افزودن یادداشت
        </Button>
      </form>
      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            هنوز یادداشتی ثبت نشده است.
          </p>
        ) : null}
        {notes.map((note) => (
          <div
            key={`${note.createdAt}-${note.body}`}
            className="rounded-md border border-border p-3"
          >
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{note.authorName}</span>
              <span>{formatDate(note.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm leading-6">{note.body}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/80 px-4 py-3">
        {icon ? <span className="text-muted-foreground/85">{icon}</span> : null}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function DetailGrid({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <div className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-sm font-medium">
            {value || '-'}
          </div>
        </div>
      ))}
    </div>
  )
}

function CompactRows({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: string; badge?: string }>
  empty: string
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/35 px-3 py-2.5"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {row.label || '-'}
            </div>
            {row.badge ? (
              <div className="truncate text-xs text-muted-foreground">
                {row.badge}
              </div>
            ) : null}
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function PrimaryCell({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">{title || '-'}</div>
      {subtitle ? (
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      ) : null}
    </div>
  )
}

function RowButton({
  label = 'مشاهده',
  icon = <Eye className="h-4 w-4" />,
  onClick,
}: {
  label?: string
  icon?: ReactNode
  onClick: () => void
}) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick}>
      {icon}
      {label}
    </Button>
  )
}

function FormField({
  label,
  name,
  defaultValue,
  placeholder,
  pattern,
  type = 'text',
  required,
  readOnly,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  pattern?: string
  type?: string
  required?: boolean
  readOnly?: boolean
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        pattern={pattern}
        required={required}
        readOnly={readOnly}
      />
    </label>
  )
}

function TextAreaField({
  label,
  name,
  defaultValue,
  placeholder,
  rows,
  required,
}: {
  label: string
  name: string
  defaultValue?: string
  placeholder?: string
  rows: number
  required?: boolean
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  hideLabel,
}: {
  label: string
  name: string
  defaultValue: string
  options: Array<[string, string]>
  hideLabel?: boolean
}) {
  return (
    <label
      className={cn('block space-y-1.5 text-sm', hideLabel ? 'space-y-0' : '')}
    >
      {hideLabel ? null : (
        <span className="text-muted-foreground">{label}</span>
      )}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="success">فعال</Badge>
  if (status === 'suspended') return <Badge variant="warning">تعلیق‌شده</Badge>
  if (status === 'archived') return <Badge variant="danger">آرشیوشده</Badge>
  return <Badge>{status || 'نامشخص'}</Badge>
}

function BooleanBadge({
  value,
  trueLabel = 'بله',
  falseLabel = 'خیر',
}: {
  value: boolean
  trueLabel?: string
  falseLabel?: string
}) {
  return (
    <Badge variant={value ? 'success' : 'outline'}>
      {value ? trueLabel : falseLabel}
    </Badge>
  )
}

function RoleBadge({ role, active }: { role: string; active: boolean }) {
  if (!role) return <Badge variant="outline">بدون نقش پلتفرمی</Badge>
  return (
    <Badge variant={active ? 'default' : 'outline'}>{formatRole(role)}</Badge>
  )
}

function MutationError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p className="text-sm text-destructive">
      {error instanceof Error ? error.message : 'عملیات انجام نشد'}
    </p>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
    </div>
  )
}

function ScreenSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-5 w-52" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

const roleOptions: Array<[PlatformRole, string]> = [
  ['platform_owner', 'مالک'],
  ['platform_admin', 'ادمین'],
  ['platform_support', 'پشتیبان'],
  ['platform_viewer', 'بیننده'],
]

function formatRole(role: string) {
  const roles: Record<string, string> = {
    platform_owner: 'مالک',
    platform_admin: 'ادمین',
    platform_support: 'پشتیبان',
    platform_viewer: 'بیننده',
  }
  return roles[role] ?? role
}

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

function number(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}

function formatDate(value: unknown): string {
  const raw = text(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function shortId(value: unknown) {
  const id = text(value)
  if (!id) return ''
  return id.length > 8 ? id.slice(0, 8) : id
}
