import {
  getApiV1AdminSalonsByIdSetupCatalogOptions,
  getApiV1AdminSalonsByIdSetupCatalogQueryKey,
  patchApiV1AdminSalonsByIdSetupCatalogAddonsByEntityIdMutation,
  patchApiV1AdminSalonsByIdSetupCatalogCategoriesByEntityIdMutation,
  patchApiV1AdminSalonsByIdSetupCatalogServicesByEntityIdMutation,
  postApiV1AdminSalonsByIdSetupCatalogAddonsMutation,
  postApiV1AdminSalonsByIdSetupCatalogCategoriesMutation,
  postApiV1AdminSalonsByIdSetupCatalogPresetsByPresetIdApplyMutation,
  postApiV1AdminSalonsByIdSetupCatalogServicesMutation,
} from '@repo/api-client/query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Plus, Sparkles } from 'lucide-react'

import { ErrorPanel } from '#/components/admin/error-panel'
import { MutationError } from '#/components/admin/mutation-error'
import { ScreenSkeleton } from '#/components/admin/screen-skeleton'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Panel } from '#/components/admin/panel'
import { Checkbox } from '#/components/ui/checkbox'

type Row = Record<string, unknown> & {
  id: string
  name: string
  active?: boolean
}
type Service = Row & {
  categoryId: string
  duration: number
  price: number
  color?: string
}
type AddonScope =
  | { type: 'category'; categoryId: string }
  | { type: 'service'; serviceId: string }
type Addon = Row & {
  priceDelta: number
  durationDelta: number
  scopes?: AddonScope[]
}
type Preset = Row & {
  tree: Array<{
    services: unknown[]
  }>
}

function string(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim()
}

function number(form: FormData, name: string) {
  return Number(form.get(name) ?? 0)
}

function mutationMeta(overrideMode: boolean) {
  return {
    ...(overrideMode ? { override: true as const } : {}),
  }
}

function Field({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  )
}

export function SalonSetupCatalog({
  salonId,
  overrideMode,
}: {
  salonId: string
  isLiveData: boolean
  overrideMode: boolean
}) {
  const queryClient = useQueryClient()
  const catalog = useQuery(
    getApiV1AdminSalonsByIdSetupCatalogOptions({
      path: { id: salonId },
      ...(overrideMode ? { query: { override: true } } : {}),
    }),
  )
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getApiV1AdminSalonsByIdSetupCatalogQueryKey({
        path: { id: salonId },
        ...(overrideMode ? { query: { override: true } } : {}),
      }),
    })
  const applyPreset = useMutation({
    ...postApiV1AdminSalonsByIdSetupCatalogPresetsByPresetIdApplyMutation(),
    onSuccess: refresh,
  })
  const createCategory = useMutation({
    ...postApiV1AdminSalonsByIdSetupCatalogCategoriesMutation(),
    onSuccess: refresh,
  })
  const updateCategory = useMutation({
    ...patchApiV1AdminSalonsByIdSetupCatalogCategoriesByEntityIdMutation(),
    onSuccess: refresh,
  })
  const createService = useMutation({
    ...postApiV1AdminSalonsByIdSetupCatalogServicesMutation(),
    onSuccess: refresh,
  })
  const updateService = useMutation({
    ...patchApiV1AdminSalonsByIdSetupCatalogServicesByEntityIdMutation(),
    onSuccess: refresh,
  })
  const createAddon = useMutation({
    ...postApiV1AdminSalonsByIdSetupCatalogAddonsMutation(),
    onSuccess: refresh,
  })
  const updateAddon = useMutation({
    ...patchApiV1AdminSalonsByIdSetupCatalogAddonsByEntityIdMutation(),
    onSuccess: refresh,
  })

  if (catalog.isLoading)
    return <ScreenSkeleton label="در حال بارگذاری کاتالوگ خدمات" />
  if (catalog.isError)
    return (
      <ErrorPanel
        message="بارگذاری کاتالوگ خدمات ناموفق بود."
        onRetry={() => void catalog.refetch()}
      />
    )

  const categories = (catalog.data?.categories ?? []) as Row[]
  const services = (catalog.data?.services ?? []) as Service[]
  const addons = (catalog.data?.addons ?? []) as Addon[]
  const presets = (catalog.data?.presets ?? []) as Preset[]
  const error =
    applyPreset.error ??
    createCategory.error ??
    updateCategory.error ??
    createService.error ??
    updateService.error ??
    createAddon.error ??
    updateAddon.error

  return (
    <div className="space-y-4">
      <Panel title="شروع سریع با قالب خدمات">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {presets.map((preset) => (
            <form
              key={preset.id}
              className="rounded-xl border bg-muted/20 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                applyPreset.mutate({
                  path: { id: salonId, presetId: preset.id },
                  body: {
                    selection: preset.tree.map((category, categoryIndex) => ({
                      categoryIndex,
                      serviceIndices: Array.from(
                        { length: presetServiceCount(category) },
                        (_, index) => index,
                      ),
                    })),
                    ...mutationMeta(overrideMode),
                  },
                })
              }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <strong>{preset.name}</strong>
              </div>
              <Button
                className="mt-3 w-full"
                type="submit"
                disabled={applyPreset.isPending}
              >
                اعمال همه خدمات قالب
              </Button>
            </form>
          ))}
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              قالب فعالی بدون تداخل با کاتالوگ فعلی وجود ندارد.
            </p>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <CatalogSection title="دسته‌ها" count={categories.length}>
          <form
            className="space-y-3 rounded-xl border border-dashed p-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              createCategory.mutate({
                path: { id: salonId },
                body: {
                  name: string(form, 'name'),
                  active: true,
                  ...mutationMeta(overrideMode),
                },
              })
            }}
          >
            <Field
              label="دسته جدید"
              name="name"
              required
              placeholder="مثلاً مو"
            />
            <Button type="submit" variant="outline">
              <Plus /> افزودن دسته
            </Button>
          </form>
          {categories.map((row) => (
            <EditableRow
              key={row.id}
              label={row.name}
              active={row.active}
              onSubmit={(form) =>
                updateCategory.mutate({
                  path: { id: salonId, entityId: row.id },
                  body: {
                    name: string(form, 'name'),
                    active: form.get('active') === 'on',
                    ...mutationMeta(overrideMode),
                  },
                })
              }
            />
          ))}
        </CatalogSection>

        <CatalogSection title="خدمات" count={services.length}>
          <ServiceForm
            categories={categories}
            onSubmit={(form) =>
              createService.mutate({
                path: { id: salonId },
                body: serviceBody(form, overrideMode, true),
              })
            }
          />
          {services.map((row) => (
            <EditableRow
              key={row.id}
              label={`${row.name} · ${row.duration} دقیقه · ${row.price.toLocaleString('fa-IR')}`}
              active={row.active}
              extra={<ServiceFields categories={categories} row={row} />}
              onSubmit={(form) =>
                updateService.mutate({
                  path: { id: salonId, entityId: row.id },
                  body: serviceBody(form, overrideMode),
                })
              }
              hideName
            />
          ))}
        </CatalogSection>

        <CatalogSection title="افزودنی‌ها" count={addons.length}>
          <AddonForm
            onSubmit={(form) =>
              createAddon.mutate({
                path: { id: salonId },
                body: addonBody(form, overrideMode, true),
              })
            }
          />
          {addons.map((row) => (
            <EditableRow
              key={row.id}
              label={`${row.name} · +${row.durationDelta} دقیقه · +${row.priceDelta.toLocaleString('fa-IR')}`}
              active={row.active}
              extra={<AddonFields row={row} />}
              onSubmit={(form) =>
                updateAddon.mutate({
                  path: { id: salonId, entityId: row.id },
                  body: addonBody(form, overrideMode, false, row.scopes),
                })
              }
              hideName
            />
          ))}
        </CatalogSection>
      </div>
      <MutationError error={error} />
    </div>
  )
}

function CatalogSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <Panel title={`${title} (${count.toLocaleString('fa-IR')})`}>
      <div className="space-y-3">{children}</div>
    </Panel>
  )
}

function EditableRow({
  label,
  active = true,
  extra,
  onSubmit,
  hideName,
}: {
  label: string
  active?: boolean
  extra?: React.ReactNode
  onSubmit: (form: FormData) => void
  hideName?: boolean
}) {
  return (
    <details className="group rounded-xl border bg-card open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span className="font-medium">{label}</span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <form
        className="space-y-3 border-t p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(new FormData(event.currentTarget))
        }}
      >
        {!hideName ? (
          <Field label="نام" name="name" defaultValue={label} required />
        ) : null}
        {extra}
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox name="active" defaultChecked={active} /> فعال
        </label>
        <Button type="submit">
          <Check /> ذخیره تغییرات
        </Button>
      </form>
    </details>
  )
}

function CatalogSelect({
  name,
  label,
  rows,
  defaultValue,
  required,
}: {
  name: string
  label: string
  rows: Row[]
  defaultValue?: string | null
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        name={name}
        defaultValue={defaultValue ?? undefined}
        required={required}
      >
        <SelectTrigger>
          <SelectValue placeholder="انتخاب کنید" />
        </SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ServiceFields({
  categories,
  row,
}: {
  categories: Row[]
  row?: Service
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="نام خدمت" name="name" defaultValue={row?.name} required />
      <CatalogSelect
        name="categoryId"
        label="دسته"
        rows={categories}
        defaultValue={row?.categoryId}
        required
      />
      <Field
        label="مدت (دقیقه)"
        name="duration"
        type="number"
        min={1}
        defaultValue={row?.duration ?? 30}
        required
      />
      <Field
        label="قیمت (ریال)"
        name="price"
        type="number"
        min={0}
        defaultValue={row?.price ?? 0}
        required
      />
      <Field
        label="رنگ تقویم"
        name="color"
        defaultValue={row?.color ?? 'rose'}
        required
      />
    </div>
  )
}

function ServiceForm({
  categories,
  onSubmit,
}: {
  categories: Row[]
  onSubmit: (form: FormData) => void
}) {
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed p-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(new FormData(event.currentTarget))
      }}
    >
      <ServiceFields categories={categories} />
      <Button type="submit" variant="outline">
        <Plus /> افزودن خدمت
      </Button>
    </form>
  )
}

function serviceBody(form: FormData, overrideMode: boolean, isCreate = false) {
  return {
    name: string(form, 'name'),
    categoryId: string(form, 'categoryId'),
    duration: number(form, 'duration'),
    price: number(form, 'price'),
    color: string(form, 'color'),
    active: isCreate || form.get('active') !== null,
    ...mutationMeta(overrideMode),
  }
}

function AddonFields({ row }: { row?: Addon }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field
        label="نام افزودنی"
        name="name"
        defaultValue={row?.name}
        required
      />
      <Field
        label="افزایش قیمت"
        name="priceDelta"
        type="number"
        min={0}
        defaultValue={row?.priceDelta ?? 0}
        required
      />
      <Field
        label="افزایش زمان"
        name="durationDelta"
        type="number"
        min={0}
        defaultValue={row?.durationDelta ?? 0}
        required
      />
    </div>
  )
}

function AddonForm({ onSubmit }: { onSubmit: (form: FormData) => void }) {
  return (
    <form
      className="space-y-3 rounded-xl border border-dashed p-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(new FormData(event.currentTarget))
      }}
    >
      <AddonFields />
      <Button type="submit" variant="outline">
        <Plus /> افزودن افزودنی
      </Button>
    </form>
  )
}

function addonBody(
  form: FormData,
  overrideMode: boolean,
  isCreate = false,
  scopes: AddonScope[] = [],
) {
  return {
    name: string(form, 'name'),
    priceDelta: number(form, 'priceDelta'),
    durationDelta: number(form, 'durationDelta'),
    active: isCreate || form.get('active') !== null,
    sortOrder: 0,
    scopes,
    ...mutationMeta(overrideMode),
  }
}

function presetServiceCount(category: Preset['tree'][number]) {
  return Array.isArray(category.services) ? category.services.length : 0
}
