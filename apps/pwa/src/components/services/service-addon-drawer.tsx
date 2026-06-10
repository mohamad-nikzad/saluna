import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Plus, X } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Textarea } from '@repo/ui/textarea'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import type {
  Service,
  ServiceAddon,
  ServiceAddonScope,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'
import { serviceAddonFormSchema } from '@repo/salon-core/forms/service'
import type {
  ServiceAddonFormInput,
  ServiceAddonFormPayload,
  ServiceAddonScopeInput,
} from '@repo/salon-core/forms/service'
import { useSaveServiceAddonMutation } from '#/lib/services-queries'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'
import { LocalizedNumberInput } from '#/components/localized-number-input'

interface ServiceAddonDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  addon: ServiceAddon | null
  categories: ServiceCategory[]
  families: ServiceFamily[]
  services: Service[]
  nextSortOrder: number
  onSuccess: () => void
}

function scopeKey(scope: ServiceAddonScopeInput) {
  if (scope.type === 'category') return `category:${scope.categoryId}`
  if (scope.type === 'family') return `family:${scope.familyId}`
  return `service:${scope.serviceId}`
}

function addonScopeToInput(scope: ServiceAddonScope): ServiceAddonScopeInput {
  if (scope.type === 'category')
    return { type: 'category', categoryId: scope.categoryId }
  if (scope.type === 'family')
    return { type: 'family', familyId: scope.familyId }
  return { type: 'service', serviceId: scope.serviceId }
}

function emptyValues(sortOrder: number): ServiceAddonFormInput {
  return {
    name: '',
    priceDelta: 0,
    durationDelta: 0,
    active: true,
    sortOrder,
    description: '',
    scopes: [],
  }
}

function addonToValues(addon: ServiceAddon): ServiceAddonFormInput {
  return {
    name: addon.name,
    priceDelta: addon.priceDelta,
    durationDelta: addon.durationDelta,
    active: addon.active,
    sortOrder: addon.sortOrder,
    description: addon.description ?? '',
    scopes: addon.scopes.map(addonScopeToInput),
  }
}

function formatScope(
  scope: ServiceAddonScopeInput,
  categories: ServiceCategory[],
  families: ServiceFamily[],
  services: Service[],
) {
  if (scope.type === 'category') {
    return {
      label:
        categories.find((item) => item.id === scope.categoryId)?.name ?? 'دسته',
      level: 'دسته',
    }
  }
  if (scope.type === 'family') {
    return {
      label:
        families.find((item) => item.id === scope.familyId)?.name ??
        'خانواده خدمت',
      level: 'خانواده خدمت',
    }
  }
  return {
    label: services.find((item) => item.id === scope.serviceId)?.name ?? 'خدمت',
    level: 'خدمت',
  }
}

export function ServiceAddonDrawer({
  open,
  onOpenChange,
  addon,
  categories,
  families,
  services,
  nextSortOrder,
  onSuccess,
}: ServiceAddonDrawerProps) {
  const isEditing = Boolean(addon)
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ServiceAddonFormInput, unknown, ServiceAddonFormPayload>({
    resolver: zodResolver(serviceAddonFormSchema),
    defaultValues: emptyValues(nextSortOrder),
  })

  useEffect(() => {
    if (!open) return
    reset(addon ? addonToValues(addon) : emptyValues(nextSortOrder))
  }, [addon, nextSortOrder, open, reset])

  const watchedScopes = useWatch({ control, name: 'scopes' })
  const scopes = useMemo(() => watchedScopes ?? [], [watchedScopes])
  const scopeKeys = useMemo(() => new Set(scopes.map(scopeKey)), [scopes])

  const addScope = (scope: ServiceAddonScopeInput) => {
    const key = scopeKey(scope)
    if (scopeKeys.has(key)) return
    setValue('scopes', [...scopes, scope], {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const removeScope = (scope: ServiceAddonScopeInput) => {
    const key = scopeKey(scope)
    setValue(
      'scopes',
      scopes.filter((item) => scopeKey(item) !== key),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  const saveAddon = useSaveServiceAddonMutation(addon?.id)

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveAddon.mutateAsync(values)
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: isDirty && !isSubmitting,
    onClose: () => onOpenChange(false),
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      onOpenChange(true)
      return
    }
    requestClose(false)
  }

  useKeyboardInset(open)

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="pb-[var(--keyboard-inset,0px)] transition-[padding-bottom] duration-150">
        <DrawerHeader>
          <DrawerTitle>
            {isEditing ? 'ویرایش افزودنی' : 'افزودنی جدید'}
          </DrawerTitle>
          <DrawerDescription>
            افزودنی‌ها روی خدمت‌های انتخاب‌شده به قیمت یا زمان رزرو اضافه
            می‌شوند.
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 flex flex-col gap-4 overflow-y-auto p-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="addon-name">نام افزودنی</FieldLabel>
              <Input id="addon-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="addon-price">
                  افزایش قیمت (تومان)
                </FieldLabel>
                <Controller
                  control={control}
                  name="priceDelta"
                  render={({ field }) => (
                    <LocalizedNumberInput
                      id="addon-price"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={() => {
                        field.onBlur()
                        void trigger('priceDelta')
                      }}
                    />
                  )}
                />
                {errors.priceDelta && (
                  <FieldError>{errors.priceDelta.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="addon-duration">
                  افزایش زمان (دقیقه)
                </FieldLabel>
                <Controller
                  control={control}
                  name="durationDelta"
                  render={({ field }) => (
                    <LocalizedNumberInput
                      id="addon-duration"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={() => {
                        field.onBlur()
                        void trigger('durationDelta')
                      }}
                    />
                  )}
                />
                {errors.durationDelta && (
                  <FieldError>{errors.durationDelta.message}</FieldError>
                )}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="addon-description">توضیح کوتاه</FieldLabel>
              <Textarea
                id="addon-description"
                rows={3}
                {...register('description')}
              />
              {errors.description && (
                <FieldError>{errors.description.message}</FieldError>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>وضعیت</FieldLabel>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Select
                      value={field.value ? 'on' : 'off'}
                      onValueChange={(value) => field.onChange(value === 'on')}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">فعال</SelectItem>
                        <SelectItem value="off">غیرفعال</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="addon-sort">ترتیب نمایش</FieldLabel>
                <Controller
                  control={control}
                  name="sortOrder"
                  render={({ field }) => (
                    <LocalizedNumberInput
                      id="addon-sort"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={() => {
                        field.onBlur()
                        void trigger('sortOrder')
                      }}
                    />
                  )}
                />
              </Field>
            </div>
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">دامنه نمایش</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  حداقل یک دسته، خانواده خدمت یا خدمت را انتخاب کنید.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Select
                  onValueChange={(value) =>
                    addScope({ type: 'category', categoryId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="افزودن دسته" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        disabled={scopeKeys.has(`category:${category.id}`)}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  onValueChange={(value) =>
                    addScope({ type: 'family', familyId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="افزودن خانواده خدمت" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((family) => (
                      <SelectItem
                        key={family.id}
                        value={family.id}
                        disabled={scopeKeys.has(`family:${family.id}`)}
                      >
                        {family.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  onValueChange={(value) =>
                    addScope({ type: 'service', serviceId: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="افزودن خدمت" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem
                        key={service.id}
                        value={service.id}
                        disabled={scopeKeys.has(`service:${service.id}`)}
                      >
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {scopes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {scopes.map((scope) => {
                    const formatted = formatScope(
                      scope,
                      categories,
                      families,
                      services,
                    )
                    return (
                      <span
                        key={scopeKey(scope)}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
                      >
                        <span className="text-muted-foreground">
                          {formatted.level}
                        </span>
                        <span>{formatted.label}</span>
                        <button
                          type="button"
                          className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => removeScope(scope)}
                          aria-label={`حذف ${formatted.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background px-3 py-3 text-xs text-muted-foreground">
                  <Plus className="h-4 w-4" />
                  هنوز دامنه‌ای انتخاب نشده است.
                </div>
              )}
              {errors.scopes && (
                <FieldError>{errors.scopes.message}</FieldError>
              )}
            </div>
          </FieldGroup>
        </form>
        <DrawerFooter>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || scopes.length === 0}
          >
            {isSubmitting ? (
              <Spinner className="ml-2" />
            ) : (
              <Check className="ml-2 h-4 w-4" />
            )}
            {isSubmitting ? '…' : isEditing ? 'ذخیره' : 'افزودن'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={isSubmitting}
          >
            انصراف
          </Button>
        </DrawerFooter>
      </DrawerContent>
      {confirmDialog}
    </Drawer>
  )
}
