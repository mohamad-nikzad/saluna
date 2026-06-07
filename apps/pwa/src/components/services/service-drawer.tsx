import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Clock3, PackageCheck, Trash2 } from 'lucide-react'
import {
  FormSheet,
  FormSheetContent,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetDescription,
  FormSheetFooter,
} from '#/components/form-sheet'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Textarea } from '@repo/ui/textarea'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { STAFF_COLORS } from '@repo/salon-core/types'
import type {
  Service,
  ServiceCategory,
  ServiceFamily,
} from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { calendarColorOptions } from '@repo/brand-tokens/calendar-colors'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { serviceFormSchema } from '@repo/salon-core/forms/service'
import type { ServiceFormInput } from '@repo/salon-core/forms/service'
import { useQuery } from '@tanstack/react-query'
import {
  comboComponentsQueryOptions,
  useSaveServiceMutation,
} from '#/lib/services-queries'
import { LocalizedNumberInput } from '#/components/localized-number-input'
import { ServicePicker } from './service-picker'

interface ServiceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
  services: Service[]
  categories: ServiceCategory[]
  families: ServiceFamily[]
  defaultCategoryId?: string | null
  defaultFamilyId?: string | null
  onSuccess: () => void
}

const NO_FAMILY_VALUE = '__none__'

function emptyValues(
  defaultCategoryId?: string | null,
  defaultFamilyId?: string | null,
): ServiceFormInput {
  return {
    name: '',
    categoryId: defaultCategoryId ?? '',
    familyId: defaultFamilyId ?? '',
    category: 'hair',
    duration: 45,
    price: 0,
    color: STAFF_COLORS[0],
    active: true,
    description: '',
    kind: 'standard',
  }
}

function serviceToFormValues(service: Service): ServiceFormInput {
  return {
    name: service.name,
    categoryId: service.categoryId,
    familyId: service.familyId ?? '',
    category: service.category,
    duration: service.duration,
    price: service.price,
    color: normalizeCalendarColorId(service.color),
    active: service.active,
    description: service.description ?? '',
    kind: service.kind ?? 'standard',
  }
}

export function ServiceDrawer({
  open,
  onOpenChange,
  service,
  services,
  categories,
  families,
  defaultCategoryId,
  defaultFamilyId,
  onSuccess,
}: ServiceDrawerProps) {
  const isEditing = !!service
  const [componentIds, setComponentIds] = useState<string[]>([])
  const [initialComponentIds, setInitialComponentIds] = useState<string[]>([])
  const isComboService = service?.kind === 'combo'
  const comboQuery = useQuery({
    ...comboComponentsQueryOptions(service!.id),
    enabled: open && !!service?.id && isComboService,
  })
  const loadingComponents = comboQuery.isFetching
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ServiceFormInput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: emptyValues(defaultCategoryId, defaultFamilyId),
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (!open) return
    if (service) {
      reset(serviceToFormValues(service))
      return
    }
    const familyForDefault = defaultFamilyId
      ? families.find((family) => family.id === defaultFamilyId)
      : undefined
    const initialCategoryId =
      defaultCategoryId ?? familyForDefault?.categoryId ?? categories[0]?.id
    reset(emptyValues(initialCategoryId, defaultFamilyId))
  }, [
    categories,
    defaultCategoryId,
    defaultFamilyId,
    families,
    open,
    reset,
    service,
  ])

  const nameValue = useWatch({ control, name: 'name' })
  const categoryValue = useWatch({ control, name: 'categoryId' })
  const familyOptions = families.filter(
    (family) => family.categoryId === categoryValue,
  )
  const kindValue = useWatch({ control, name: 'kind' })
  const activeValue = useWatch({ control, name: 'active' })
  const isCombo = kindValue === 'combo'
  const componentServices = componentIds
    .map((id) => services.find((item) => item.id === id))
    .filter((item): item is Service => Boolean(item))
  const componentTotals = componentServices.reduce(
    (sum, item) => ({
      duration: sum.duration + item.duration,
      price: sum.price + item.price,
    }),
    { duration: 0, price: 0 },
  )
  const selectableComponentServices = services.filter(
    (item) => item.kind !== 'combo' && item.id !== service?.id,
  )

  useEffect(() => {
    if (!open) return
    if (!isComboService) {
      setComponentIds([])
      setInitialComponentIds([])
      return
    }
    const ids =
      comboQuery.data?.components.map(
        (component) => component.componentServiceId,
      ) ?? []
    setComponentIds(ids)
    setInitialComponentIds(ids)
  }, [comboQuery.data, isComboService, open])

  const saveService = useSaveServiceMutation(service?.id)

  const onSubmit = handleSubmit(async (values) => {
    const payload = serviceFormSchema.safeParse(values)
    if (payload.success && !payload.data.categoryId) {
      setError('categoryId', { message: 'بخش خدمات را انتخاب کنید' })
      return
    }
    try {
      await saveService.mutateAsync({ values, componentIds })
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const componentsDirty =
    componentIds.length !== initialComponentIds.length ||
    componentIds.some((id, i) => id !== initialComponentIds[i])

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: (isDirty || componentsDirty) && !isSubmitting,
    onClose: () => onOpenChange(false),
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      onOpenChange(true)
      return
    }
    requestClose(false)
  }

  return (
    <FormSheet open={open} onOpenChange={handleOpenChange}>
      <FormSheetContent onRequestClose={() => requestClose(false)}>
        <FormSheetHeader>
          <FormSheetTitle>
            {isEditing ? 'ویرایش خدمت' : 'خدمت جدید'}
          </FormSheetTitle>
          <FormSheetDescription>
            نام، زمان انجام و قیمت را وارد کنید
          </FormSheetDescription>
        </FormSheetHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="svc-name">نام خدمت</FieldLabel>
              <Input id="svc-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>بخش</FieldLabel>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      setValue('familyId', '', { shouldDirty: true })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="انتخاب بخش" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && (
                <FieldError>{errors.categoryId.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel>گروه (اختیاری)</FieldLabel>
              <Controller
                control={control}
                name="familyId"
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : NO_FAMILY_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === NO_FAMILY_VALUE ? '' : value)
                    }
                    disabled={!categoryValue}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="بدون گروه" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_FAMILY_VALUE}>بدون گروه</SelectItem>
                      {familyOptions.map((family) => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.familyId && (
                <FieldError>{errors.familyId.message}</FieldError>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="svc-dur">مدت (دقیقه)</FieldLabel>
                <Controller
                  control={control}
                  name="duration"
                  render={({ field }) => (
                    <LocalizedNumberInput
                      id="svc-dur"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={() => {
                        field.onBlur()
                        void trigger('duration')
                      }}
                    />
                  )}
                />
                {errors.duration && (
                  <FieldError>{errors.duration.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="svc-price">قیمت (تومان)</FieldLabel>
                <Controller
                  control={control}
                  name="price"
                  render={({ field }) => (
                    <LocalizedNumberInput
                      id="svc-price"
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={() => {
                        field.onBlur()
                        void trigger('price')
                      }}
                    />
                  )}
                />
                {errors.price && (
                  <FieldError>{errors.price.message}</FieldError>
                )}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="svc-description">توضیح کوتاه</FieldLabel>
              <Textarea
                id="svc-description"
                rows={3}
                {...register('description')}
              />
              {errors.description && (
                <FieldError>{errors.description.message}</FieldError>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>نوع خدمت</FieldLabel>
                <Controller
                  control={control}
                  name="kind"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? 'standard'}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">معمولی</SelectItem>
                        <SelectItem value="combo">ترکیبی</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.kind && <FieldError>{errors.kind.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel>وضعیت</FieldLabel>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <Select
                      value={field.value ? 'on' : 'off'}
                      onValueChange={(v) => field.onChange(v === 'on')}
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
            </div>
            <Field>
              <FieldLabel>رنگ در تقویم</FieldLabel>
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <Select
                    value={normalizeCalendarColorId(field.value)}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {calendarColorOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="size-3 rounded-full border border-border"
                              style={{
                                backgroundColor: `var(--calendar-${option.id})`,
                              }}
                            />
                            <span>{option.labelFa}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.color && <FieldError>{errors.color.message}</FieldError>}
            </Field>
            {isCombo ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">ترکیب پکیج</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      مدت و قیمت اصلی همین فرم ذخیره می‌شود؛ مجموع زیر فقط مرجع
                      خدمات انتخاب‌شده است.
                    </p>
                  </div>
                  {componentIds.length === 0 ? (
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] text-amber-800">
                      پیش‌نویس ناقص
                    </span>
                  ) : (
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary">
                      {toPersianDigits(componentIds.length)} جزء
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border/50 bg-background px-2 py-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      مجموع زمان اجزا
                    </div>
                    <p className="mt-1 font-semibold">
                      {toPersianDigits(componentTotals.duration)} دقیقه
                    </p>
                  </div>
                  <div className="rounded-md border border-border/50 bg-background px-2 py-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <PackageCheck className="h-3.5 w-3.5" />
                      مجموع قیمت اجزا
                    </div>
                    <p className="mt-1 font-semibold">
                      {componentTotals.price > 0
                        ? `${toPersianDigits(componentTotals.price.toLocaleString('fa-IR'))} تومان`
                        : 'قیمت وارد نشده'}
                    </p>
                  </div>
                </div>
                <ServicePicker
                  services={selectableComponentServices}
                  value=""
                  onChange={(id) =>
                    setComponentIds((current) =>
                      current.includes(id) ? current : [...current, id],
                    )
                  }
                  placeholder={
                    loadingComponents
                      ? 'در حال خواندن اجزا...'
                      : 'افزودن خدمت به پکیج'
                  }
                  disabled={loadingComponents || isSubmitting}
                  getDisabledReason={(item) =>
                    componentIds.includes(item.id) ? 'انتخاب شده' : null
                  }
                />
                {componentServices.length > 0 ? (
                  <div className="space-y-1.5">
                    {componentServices.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {toPersianDigits(item.duration)} دقیقه ·{' '}
                            {item.price > 0
                              ? `${toPersianDigits(item.price.toLocaleString('fa-IR'))} تومان`
                              : 'قیمت وارد نشده'}
                            {!item.active ? ' · غیرفعال' : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`حذف ${item.name} از پکیج`}
                          onClick={() =>
                            setComponentIds((current) =>
                              current.filter((id) => id !== item.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {activeValue && componentIds.length === 0 ? (
                  <p className="text-xs leading-5 text-amber-700">
                    پکیج فعال بدون جزء ذخیره نمی‌شود؛ چند خدمت اضافه کنید یا
                    وضعیت را غیرفعال بگذارید.
                  </p>
                ) : null}
              </div>
            ) : null}
          </FieldGroup>
        </form>

        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={
              isSubmitting ||
              !nameValue ||
              !categoryValue ||
              (isCombo && activeValue && componentIds.length === 0)
            }
            className="touch-manipulation"
          >
            {isSubmitting && <Spinner className="ml-2" />}
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
        </FormSheetFooter>
      </FormSheetContent>
      {confirmDialog}
    </FormSheet>
  )
}
