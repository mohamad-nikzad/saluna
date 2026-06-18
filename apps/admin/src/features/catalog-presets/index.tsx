import {
  getApiV1AdminCatalogPresetsOptions,
  getApiV1AdminCatalogPresetsQueryKey,
  patchApiV1AdminCatalogPresetsByIdMutation,
  postApiV1AdminCatalogPresetsMutation,
} from '@repo/api-client/query'
import type {
  AdminCatalogPresetCreateRequest,
} from '@repo/api-client/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import {
  CopyPlus,
  FolderTree,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { DataTable } from '#/components/data-table/data-table'
import { DataTablePagination } from '#/components/data-table/data-table-pagination'
import { DataTableToolbar } from '#/components/data-table/data-table-toolbar'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { useAdminAuth } from '#/context/admin-auth-provider'
import { useTableUrlState } from '#/hooks/use-table-url-state'
import { cn } from '#/lib/utils'

type RecordRow = Record<string, unknown>

type PresetVariant = {
  name: string
  duration: number
  price: number
  color: string
  description?: string | null
}

type PresetFamily = {
  name: string
  variants: PresetVariant[]
}

type PresetCategory = {
  name: string
  families: PresetFamily[]
}

type CatalogPresetTree = PresetCategory[]

type CatalogPresetRow = RecordRow & {
  id?: string
  slug?: string
  name?: string
  description?: string | null
  tree?: unknown
  sortOrder?: number
  isActive?: boolean
}

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

const defaultVariant = (): PresetVariant => ({
  name: '',
  duration: 30,
  price: 0,
  color: 'teal',
  description: null,
})

const defaultFamily = (): PresetFamily => ({
  name: '',
  variants: [defaultVariant()],
})

const defaultCategory = (): PresetCategory => ({
  name: '',
  families: [defaultFamily()],
})

const defaultTree = (): CatalogPresetTree => [defaultCategory()]

export function CatalogPresetsPage() {
  return (
    <>
      <AdminPageHeader
        title="Catalog Presets"
        description="مدیریت قالب خدمات با ساختار category، family و service variant."
      />
      <CatalogPresetsScreen />
    </>
  )
}

export function CatalogPresetsScreen() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<CatalogPresetRow | 'new' | null>(null)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Catalog Preset',
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
        accessorKey: 'tree',
        header: 'درخت قالب خدمات',
        cell: ({ row }) => <TreeSummary tree={row.original.tree} />,
      },
      {
        accessorKey: 'sortOrder',
        header: 'ترتیب',
        cell: ({ row }) => number(row.original.sortOrder),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(row.original as CatalogPresetRow)}
          >
            <Pencil className="h-4 w-4" />
            ویرایش
          </Button>
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
        searchPlaceholder="جستجو در Catalog Presets بر اساس نام یا slug..."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            Catalog Preset جدید
          </Button>
        }
      />
      <CatalogPresetDialog
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
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <DataTableToolbar
            query={tableState.query}
            onQueryChange={(query) => setTableState({ query, page: 1 })}
            onReset={() => setTableState({ query: '', page: 1, sort: '' })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {searchPlaceholder}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {listQuery.isLoading ? (
        <ScreenSkeleton label="در حال دریافت Catalog Presets" />
      ) : null}
      {listQuery.isError ? (
        <ErrorPanel message="بارگذاری Catalog Presets انجام نشد." />
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

function CatalogPresetDialog({
  preset,
  onOpenChange,
  onSaved,
}: {
  preset: CatalogPresetRow | 'new' | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const isNew = preset === 'new'
  const source = preset && preset !== 'new' ? preset : {}
  const { runtime } = useAdminAuth()
  const isLiveData = runtime.dataSource === 'live'
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
    <Dialog open={Boolean(preset)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,920px)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'Catalog Preset جدید' : 'ویرایش Catalog Preset'}
          </DialogTitle>
          <DialogDescription>
            قالب خدمات را با زبان category، family و service variant ویرایش
            کنید.
          </DialogDescription>
        </DialogHeader>
        <CatalogPresetForm
          source={source}
          error={activeMutation.error}
          isLiveData={isLiveData}
          pending={activeMutation.isPending}
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
      </DialogContent>
    </Dialog>
  )
}

function CatalogPresetForm({
  source,
  pending,
  error,
  isLiveData,
  onSubmit,
}: {
  source: CatalogPresetRow
  pending: boolean
  error: unknown
  isLiveData: boolean
  onSubmit: (input: AdminCatalogPresetCreateRequest) => void
}) {
  const [tree, setTree] = useState<CatalogPresetTree>(() =>
    normalizeTree(source.tree),
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onSubmit({
      slug: String(form.get('slug') ?? ''),
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') || '') || null,
      tree,
      sortOrder: Number(form.get('sortOrder') ?? 0),
      isActive: form.get('isActive') === 'on',
      reason: String(form.get('reason') ?? ''),
    })
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <LiveDataWarning show={isLiveData} />
      <section className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
        <FormField
          label="Slug"
          name="slug"
          defaultValue={text(source.slug)}
          required
        />
        <FormField
          label="نام Catalog Preset"
          name="name"
          defaultValue={text(source.name)}
          required
        />
        <FormField
          label="ترتیب"
          name="sortOrder"
          type="number"
          defaultValue={String(number(source.sortOrder))}
        />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={source.isActive !== false}
            className="h-4 w-4 accent-foreground"
          />
          فعال
        </label>
      </section>
      <TextAreaField
        label="توضیحات"
        name="description"
        defaultValue={text(source.description)}
        rows={2}
      />
      <TreeEditor tree={tree} onChange={setTree} />
      <TextAreaField
        label="دلیل"
        name="reason"
        placeholder="دلیل الزامی برای ممیزی"
        rows={3}
        required
      />
      <MutationError error={error} />
      <DialogFooter>
        <Button disabled={pending} type="submit">
          <Save className="h-4 w-4" />
          ذخیره Catalog Preset
        </Button>
      </DialogFooter>
    </form>
  )
}

function TreeEditor({
  tree,
  onChange,
}: {
  tree: CatalogPresetTree
  onChange: (tree: CatalogPresetTree) => void
}) {
  function updateCategory(index: number, next: PresetCategory) {
    onChange(tree.map((category, i) => (i === index ? next : category)))
  }

  function removeCategory(index: number) {
    onChange(tree.filter((_, i) => i !== index))
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/80 bg-background/40 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">درخت قالب خدمات</h2>
            <p className="text-xs text-muted-foreground">
              PresetCategory {'->'} PresetFamily {'->'} PresetVariant
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...tree, defaultCategory()])}
        >
          <Plus className="h-4 w-4" />
          category
        </Button>
      </div>
      <div className="space-y-3">
        {tree.map((category, categoryIndex) => (
          <CategoryEditor
            key={categoryIndex}
            category={category}
            canRemove={tree.length > 1}
            onChange={(next) => updateCategory(categoryIndex, next)}
            onRemove={() => removeCategory(categoryIndex)}
          />
        ))}
      </div>
    </section>
  )
}

function CategoryEditor({
  category,
  canRemove,
  onChange,
  onRemove,
}: {
  category: PresetCategory
  canRemove: boolean
  onChange: (category: PresetCategory) => void
  onRemove: () => void
}) {
  function updateFamily(index: number, next: PresetFamily) {
    onChange({
      ...category,
      families: category.families.map((family, i) =>
        i === index ? next : family,
      ),
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <LabeledInput
          label="category"
          value={category.name}
          required
          onChange={(name) => onChange({ ...category, name })}
        />
        <IconAction
          label="حذف category"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </IconAction>
      </div>
      <div className="space-y-3 ps-0 md:ps-4">
        {category.families.map((family, familyIndex) => (
          <FamilyEditor
            key={familyIndex}
            family={family}
            canRemove={category.families.length > 1}
            onChange={(next) => updateFamily(familyIndex, next)}
            onRemove={() =>
              onChange({
                ...category,
                families: category.families.filter(
                  (_, index) => index !== familyIndex,
                ),
              })
            }
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...category,
              families: [...category.families, defaultFamily()],
            })
          }
        >
          <Plus className="h-4 w-4" />
          family
        </Button>
      </div>
    </div>
  )
}

function FamilyEditor({
  family,
  canRemove,
  onChange,
  onRemove,
}: {
  family: PresetFamily
  canRemove: boolean
  onChange: (family: PresetFamily) => void
  onRemove: () => void
}) {
  function updateVariant(index: number, next: PresetVariant) {
    onChange({
      ...family,
      variants: family.variants.map((variant, i) =>
        i === index ? next : variant,
      ),
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-background/45 p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <LabeledInput
          label="family"
          value={family.name}
          required
          onChange={(name) => onChange({ ...family, name })}
        />
        <IconAction
          label="حذف family"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </IconAction>
      </div>
      <div className="space-y-2">
        {family.variants.map((variant, variantIndex) => (
          <VariantEditor
            key={variantIndex}
            variant={variant}
            canRemove={family.variants.length > 1}
            onChange={(next) => updateVariant(variantIndex, next)}
            onRemove={() =>
              onChange({
                ...family,
                variants: family.variants.filter(
                  (_, index) => index !== variantIndex,
                ),
              })
            }
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...family,
              variants: [...family.variants, defaultVariant()],
            })
          }
        >
          <CopyPlus className="h-4 w-4" />
          service variant
        </Button>
      </div>
    </div>
  )
}

function VariantEditor({
  variant,
  canRemove,
  onChange,
  onRemove,
}: {
  variant: PresetVariant
  canRemove: boolean
  onChange: (variant: PresetVariant) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-2 rounded-md border border-border/70 bg-card px-3 py-2 md:grid-cols-[1.2fr_100px_120px_120px_1fr_auto]">
      <LabeledInput
        label="service variant"
        value={variant.name}
        required
        onChange={(name) => onChange({ ...variant, name })}
      />
      <LabeledInput
        label="دقیقه"
        type="number"
        value={String(variant.duration)}
        required
        onChange={(duration) =>
          onChange({ ...variant, duration: Number(duration) || 0 })
        }
      />
      <LabeledInput
        label="قیمت"
        type="number"
        value={String(variant.price)}
        required
        onChange={(price) =>
          onChange({ ...variant, price: Number(price) || 0 })
        }
      />
      <LabeledInput
        label="رنگ"
        value={variant.color}
        required
        onChange={(color) => onChange({ ...variant, color })}
      />
      <LabeledInput
        label="توضیح service variant"
        value={variant.description ?? ''}
        onChange={(description) =>
          onChange({ ...variant, description: description || null })
        }
      />
      <IconAction
        label="حذف service variant"
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </IconAction>
    </div>
  )
}

function LiveDataWarning({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive">
      این تغییر روی داده زنده تولید اعمال می‌شود. قبل از ذخیره Catalog Preset
      و ساختار category، family و service variant را دوباره بررسی کنید.
    </div>
  )
}

function TreeSummary({ tree }: { tree: unknown }) {
  const normalized = normalizeTree(tree)
  const familyCount = normalized.reduce(
    (total, category) => total + category.families.length,
    0,
  )
  const variantCount = normalized.reduce(
    (total, category) =>
      total +
      category.families.reduce(
        (familyTotal, family) => familyTotal + family.variants.length,
        0,
      ),
    0,
  )

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">{normalized.length} category</Badge>
      <Badge variant="outline">{familyCount} family</Badge>
      <Badge variant="outline">{variantCount} service variant</Badge>
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

function BooleanBadge({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean
  trueLabel: string
  falseLabel: string
}) {
  return value ? (
    <Badge variant="success">{trueLabel}</Badge>
  ) : (
    <Badge variant="outline">{falseLabel}</Badge>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
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

function LabeledInput({
  label,
  value,
  type = 'text',
  required,
  onChange,
}: {
  label: string
  value: string
  type?: string
  required?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function IconAction({
  label,
  disabled,
  children,
  onClick,
}: {
  label: string
  disabled?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('self-end', disabled ? 'opacity-40' : '')}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function ScreenSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <Skeleton className="h-5 w-52" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {message}
    </div>
  )
}

function MutationError({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {error instanceof Error ? error.message : 'ثبت تغییر انجام نشد.'}
    </div>
  )
}

function normalizeTree(value: unknown): CatalogPresetTree {
  if (!Array.isArray(value)) return defaultTree()
  const categories = value
    .map((category) => normalizeCategory(category))
    .filter(isPresent)
  return categories.length > 0 ? categories : defaultTree()
}

function normalizeCategory(value: unknown): PresetCategory | null {
  if (!isRecord(value)) return null
  const familiesValue = value.families
  const families = Array.isArray(familiesValue)
    ? familiesValue.map((family) => normalizeFamily(family)).filter(isPresent)
    : []
  return {
    name: text(value.name),
    families: families.length > 0 ? families : [defaultFamily()],
  }
}

function normalizeFamily(value: unknown): PresetFamily | null {
  if (!isRecord(value)) return null
  const variantsValue = value.variants
  const variants = Array.isArray(variantsValue)
    ? variantsValue
        .map((variant) => normalizeVariant(variant))
        .filter(isPresent)
    : []
  return {
    name: text(value.name),
    variants: variants.length > 0 ? variants : [defaultVariant()],
  }
}

function normalizeVariant(value: unknown): PresetVariant | null {
  if (!isRecord(value)) return null
  return {
    name: text(value.name),
    duration: number(value.duration) || 30,
    price: number(value.price),
    color: text(value.color) || 'teal',
    description: text(value.description) || null,
  }
}

function isRecord(value: unknown): value is RecordRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
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
