import {
  getApiV1AdminCatalogPresetsOptions,
  getApiV1AdminCatalogPresetsQueryKey,
  patchApiV1AdminCatalogPresetsByIdMutation,
  postApiV1AdminCatalogPresetsMutation,
} from '@repo/api-client/query'
import type { AdminCatalogPresetCreateRequest } from '@repo/api-client/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { FolderTree, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState, useId, type FormEvent, type ReactNode } from 'react'

import { AdminListTable } from '#/components/admin/admin-list-table'
import { BooleanBadge } from '#/components/admin/boolean-badge'
import { PrimaryCell } from '#/components/admin/primary-cell'
import {
  CheckboxField,
  FormField,
  TextAreaField,
} from '#/components/admin/form-field'
import { LiveDataWarning } from '#/components/admin/live-data-warning'
import { MutationError } from '#/components/admin/mutation-error'
import {
  MutationSuccess,
  useMutationSuccess,
} from '#/components/admin/mutation-success'
import { AdminPageHeader } from '#/components/layout/admin-page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Field, FieldLabel } from '#/components/ui/field'
import { useAdminAuth } from '#/context/admin-auth-provider'
import { number, text } from '#/lib/admin-format'
import { cn } from '#/lib/utils'

type RecordRow = Record<string, unknown>

type PresetService = {
  name: string
  duration: number
  price: number
  color: string
  description?: string | undefined
}

type PresetCategory = {
  name: string
  services: PresetService[]
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

const defaultService = (): PresetService => ({
  name: '',
  duration: 30,
  price: 0,
  color: 'teal',
})

const defaultCategory = (): PresetCategory => ({
  name: '',
  services: [defaultService()],
})

const defaultTree = (): CatalogPresetTree => [defaultCategory()]

export function CatalogPresetsPage() {
  return (
    <>
      <AdminPageHeader
        title="الگوهای کاتالوگ"
        description="مدیریت قالب‌های سرویس با ساختار ساده دسته و خدمت."
      />
      <CatalogPresetsScreen />
    </>
  )
}

export function CatalogPresetsScreen() {
  const queryClient = useQueryClient()
  const { successMessage, showSuccess } = useMutationSuccess()
  const [editing, setEditing] = useState<CatalogPresetRow | 'new' | null>(null)
  const columns = useMemo<ColumnDef<RecordRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'الگوی کاتالوگ',
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
            falseLabel="بایگانی‌شده"
          />
        ),
      },
      {
        accessorKey: 'tree',
        header: 'ساختار خدمات',
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
      <MutationSuccess message={successMessage} />
      <AdminListTable
        from="/_admin/catalog-presets"
        columns={columns}
        queryOptionsFor={(params) =>
          getApiV1AdminCatalogPresetsOptions({ query: params })
        }
        hint="جستجوی الگوهای کاتالوگ بر اساس نام یا شناسه..."
        loadingLabel="در حال بارگذاری الگوهای کاتالوگ"
        errorMessage="بارگذاری الگوهای کاتالوگ ناموفق بود."
        toolbarActions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            الگوی جدید
          </Button>
        }
      />
      <CatalogPresetDialog
        preset={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => {
          showSuccess('الگوی کاتالوگ ذخیره شد.')
          void queryClient.invalidateQueries({
            queryKey: getApiV1AdminCatalogPresetsQueryKey(),
          })
        }}
      />
    </>
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
            {isNew ? 'الگوی جدید کاتالوگ' : 'ویرایش الگوی کاتالوگ'}
          </DialogTitle>
          <DialogDescription>
            قالب سرویس را با دسته‌ها و خدمات قابل رزرو ویرایش کنید.
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
      tree: toRequestTree(tree),
      sortOrder: Number(form.get('sortOrder') ?? 0),
      isActive: form.get('isActive') === 'on',
    })
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <LiveDataWarning
        show={isLiveData}
        message="این تغییر روی داده LIVE تولید اعمال می‌شود. قبل از ذخیره، الگوی کاتالوگ و ساختار دسته‌ها و خدمات را بررسی کنید."
      />
      <section className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
        <FormField
          label="شناسه"
          name="slug"
          defaultValue={text(source.slug)}
          required
        />
        <FormField
          label="نام الگوی کاتالوگ"
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
        <CheckboxField
          label="فعال"
          name="isActive"
          defaultChecked={source.isActive !== false}
        />
      </section>
      <TextAreaField
        label="توضیحات"
        name="description"
        defaultValue={text(source.description)}
        rows={2}
      />
      <TreeEditor tree={tree} onChange={setTree} />
      <MutationError error={error} />
      <DialogFooter>
        <Button disabled={pending} type="submit">
          <Save className="h-4 w-4" />
          ذخیره الگوی کاتالوگ
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
    <Card>
      <CardHeader className="flex flex-col gap-3 border-b-0 pb-0 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FolderTree className="text-muted-foreground" />
          <div>
            <CardTitle className="text-sm">ساختار خدمات</CardTitle>
            <p className="text-xs text-muted-foreground">دسته {'->'} خدمت</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...tree, defaultCategory()])}
        >
          <Plus className="h-4 w-4" />
          دسته
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tree.map((category, categoryIndex) => (
          <CategoryEditor
            key={categoryIndex}
            category={category}
            canRemove={tree.length > 1}
            onChange={(next) => updateCategory(categoryIndex, next)}
            onRemove={() => removeCategory(categoryIndex)}
          />
        ))}
      </CardContent>
    </Card>
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
  const [confirmRemove, setConfirmRemove] = useState(false)

  function updateService(index: number, next: PresetService) {
    onChange({
      ...category,
      services: category.services.map((service, i) =>
        i === index ? next : service,
      ),
    })
  }

  return (
    <Card className="bg-background/40">
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <LabeledInput
            label="دسته"
            value={category.name}
            required
            onChange={(name) => onChange({ ...category, name })}
          />
          <IconAction
            label="حذف دسته"
            disabled={!canRemove}
            onClick={() => setConfirmRemove(true)}
          >
            <Trash2 className="h-4 w-4" />
          </IconAction>
        </div>
        <RemoveConfirmationDialog
          open={confirmRemove}
          message="این دسته و همه موارد تو در تو حذف شوند؟"
          onConfirm={onRemove}
          onOpenChange={setConfirmRemove}
        />
        <div className="flex flex-col gap-3 ps-0 md:ps-4">
          {category.services.map((service, serviceIndex) => (
            <ServiceEditor
              key={serviceIndex}
              service={service}
              canRemove={category.services.length > 1}
              onChange={(next) => updateService(serviceIndex, next)}
              onRemove={() =>
                onChange({
                  ...category,
                  services: category.services.filter(
                    (_, index) => index !== serviceIndex,
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
                services: [...category.services, defaultService()],
              })
            }
          >
            <Plus className="h-4 w-4" />
            خدمت
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ServiceEditor({
  service,
  canRemove,
  onChange,
  onRemove,
}: {
  service: PresetService
  canRemove: boolean
  onChange: (service: PresetService) => void
  onRemove: () => void
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div className="grid gap-2 rounded-md border border-border/70 bg-card px-3 py-2 md:grid-cols-[1.2fr_100px_120px_120px_1fr_auto]">
      <LabeledInput
        label="خدمت"
        value={service.name}
        required
        onChange={(name) => onChange({ ...service, name })}
      />
      <LabeledInput
        label="دقیقه"
        type="number"
        value={String(service.duration)}
        required
        onChange={(duration) =>
          onChange({ ...service, duration: Number(duration) || 0 })
        }
      />
      <LabeledInput
        label="قیمت"
        type="number"
        value={String(service.price)}
        required
        onChange={(price) =>
          onChange({ ...service, price: Number(price) || 0 })
        }
      />
      <LabeledInput
        label="رنگ"
        value={service.color}
        required
        onChange={(color) => onChange({ ...service, color })}
      />
      <LabeledInput
        label="توضیحات خدمت"
        value={service.description ?? ''}
        onChange={(description) =>
          onChange({ ...service, description: description || undefined })
        }
      />
      <IconAction
        label="حذف خدمت"
        disabled={!canRemove}
        onClick={() => setConfirmRemove(true)}
      >
        <Trash2 className="h-4 w-4" />
      </IconAction>
      <RemoveConfirmationDialog
        open={confirmRemove}
        message="این خدمت حذف شود؟"
        onConfirm={onRemove}
        onOpenChange={setConfirmRemove}
      />
    </div>
  )
}

function RemoveConfirmationDialog({
  open,
  message,
  onConfirm,
  onOpenChange,
}: {
  open: boolean
  message: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تأیید حذف</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            انصراف
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            حذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TreeSummary({ tree }: { tree: unknown }) {
  const normalized = normalizeTree(tree)
  const serviceCount = normalized.reduce(
    (total, category) => total + category.services.length,
    0,
  )

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">{normalized.length} دسته</Badge>
      <Badge variant="outline">{serviceCount} خدمت</Badge>
    </div>
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
  const id = useId()

  return (
    <Field>
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
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

function normalizeTree(value: unknown): CatalogPresetTree {
  if (!Array.isArray(value)) return defaultTree()
  const categories = value
    .map((category) => normalizeCategory(category))
    .filter(isPresent)
  return categories.length > 0 ? categories : defaultTree()
}

function normalizeCategory(value: unknown): PresetCategory | null {
  if (!isRecord(value)) return null
  const servicesValue = value.services
  const services = Array.isArray(servicesValue)
    ? servicesValue
        .map((service) => normalizeService(service))
        .filter(isPresent)
    : normalizeLegacyServices(value.families)
  return {
    name: text(value.name),
    services: services.length > 0 ? services : [defaultService()],
  }
}

function normalizeService(value: unknown): PresetService | null {
  if (!isRecord(value)) return null
  const description = text(value.description)
  return {
    name: text(value.name),
    duration: number(value.duration) || 30,
    price: number(value.price),
    color: text(value.color) || 'teal',
    ...(description ? { description } : {}),
  }
}

function normalizeLegacyServices(value: unknown): PresetService[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((family) => {
    if (!isRecord(family) || !Array.isArray(family.variants)) return []
    return family.variants
      .map((variant) => normalizeService(variant))
      .filter(isPresent)
  })
}

function toRequestTree(
  tree: CatalogPresetTree,
): AdminCatalogPresetCreateRequest['tree'] {
  return tree.map((category) => ({
    name: category.name,
    services: category.services.map((service) => {
      const description = service.description?.trim()
      return {
        name: service.name,
        duration: service.duration,
        price: service.price,
        color: service.color,
        ...(description ? { description } : {}),
      }
    }),
  }))
}

function isRecord(value: unknown): value is RecordRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}

function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}
