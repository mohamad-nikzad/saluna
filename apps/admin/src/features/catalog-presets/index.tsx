import {
  getApiV1AdminCatalogPresetsOptions,
  getApiV1AdminCatalogPresetsQueryKey,
  patchApiV1AdminCatalogPresetsByIdMutation,
  postApiV1AdminCatalogPresetsMutation,
} from '@repo/api-client/query'
import type {
  AdminCatalogPresetCreateRequest,
} from '@repo/api-client/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CopyPlus,
  FolderTree,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { AdminListTable } from '#/components/admin/admin-list-table'
import {
  FormField,
  TextAreaField,
} from '#/components/admin/form-field'
import {
  LiveConfirmationInput,
  LiveDataWarning,
  liveConfirmationFromForm,
} from '#/components/admin/live-data-form'
import { MutationError } from '#/components/admin/mutation-error'
import {
  MutationSuccess,
  useMutationSuccess,
} from '#/components/admin/mutation-success'
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
import { useAdminAuth } from '#/context/admin-auth-provider'
import { number, text } from '#/lib/admin-format'
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
        title="الگوهای کاتالوگ"
        description="مدیریت قالب‌های سرویس با ساختار دسته، خانواده و نسخه سرویس."
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
        header: 'درخت قالب سرویس',
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
            قالب سرویس را با ساختار دسته، خانواده و نسخه سرویس ویرایش کنید.
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
      liveConfirmation: liveConfirmationFromForm(form, isLiveData),
    })
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <LiveDataWarning
        show={isLiveData}
        message="این تغییر روی داده LIVE تولید اعمال می‌شود. قبل از ذخیره، الگوی کاتالوگ و ساختار دسته، خانواده و نسخه سرویس را بررسی کنید."
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
        placeholder="دلیل برای گزارش ممیزی الزامی است"
        rows={3}
        required
      />
      <LiveConfirmationInput show={isLiveData} />
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
    <section className="space-y-3 rounded-lg border border-border/80 bg-background/40 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">درخت قالب سرویس</h2>
            <p className="text-xs text-muted-foreground">
              دسته {'->'} خانواده {'->'} نسخه سرویس
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
          دسته
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
  const [confirmRemove, setConfirmRemove] = useState(false)

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
          خانواده
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
  const [confirmRemove, setConfirmRemove] = useState(false)

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
          label="خانواده"
          value={family.name}
          required
          onChange={(name) => onChange({ ...family, name })}
        />
        <IconAction
          label="حذف خانواده"
          disabled={!canRemove}
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 className="h-4 w-4" />
        </IconAction>
      </div>
      <RemoveConfirmationDialog
        open={confirmRemove}
        message="این خانواده و همه نسخه‌های سرویس تو در تو حذف شوند؟"
        onConfirm={onRemove}
        onOpenChange={setConfirmRemove}
      />
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
          نسخه سرویس
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
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div className="grid gap-2 rounded-md border border-border/70 bg-card px-3 py-2 md:grid-cols-[1.2fr_100px_120px_120px_1fr_auto]">
      <LabeledInput
        label="نسخه سرویس"
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
        label="توضیحات نسخه سرویس"
        value={variant.description ?? ''}
        onChange={(description) =>
          onChange({ ...variant, description: description || null })
        }
      />
      <IconAction
        label="حذف نسخه سرویس"
        disabled={!canRemove}
        onClick={() => setConfirmRemove(true)}
      >
        <Trash2 className="h-4 w-4" />
      </IconAction>
      <RemoveConfirmationDialog
        open={confirmRemove}
        message="این نسخه سرویس حذف شود؟"
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
      <Badge variant="outline">{normalized.length} دسته</Badge>
      <Badge variant="outline">{familyCount} خانواده</Badge>
      <Badge variant="outline">{variantCount} نسخه سرویس</Badge>
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

function truthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1
}
