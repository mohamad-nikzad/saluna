import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banknote, Clock3, PackagePlus, Pencil, Plus, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  FormSheet,
  FormSheetContent,
  FormSheetDescription,
  FormSheetFooter,
  FormSheetHeader,
  FormSheetTitle,
} from '#/components/form-sheet'
import { LocalizedNumberInput } from '#/components/localized-number-input'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'
import { getMutationErrorMessage } from '#/lib/query-client'
import {
  servicePackagesListQueryOptions,
  useSaveServicePackageComponentsMutation,
  useSaveServicePackageMutation,
  useSaveServicePackageStaffMutation,
} from '#/lib/services-queries'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Card, CardTitle } from '@repo/ui/card'
import { Checkbox } from '@repo/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { Input } from '@repo/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import { Textarea } from '@repo/ui/textarea'
import { calendarColorOptions } from '@repo/brand-tokens/calendar-colors'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import {
  servicePackageCreateSchema,
  type ServicePackageCreateInput,
} from '@repo/salon-core/forms/service'
import type {
  Service,
  ServiceCategory,
  ServicePackage,
  User,
} from '@repo/salon-core/types'
import { STAFF_COLORS } from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { ServicePicker } from './service-picker'

interface ServicePackageManagerProps {
  services: Service[]
  categories: ServiceCategory[]
  staff: User[]
  onChanged: () => void
}

const NO_CATEGORY_VALUE = '__none__'

function emptyPackageValues(sortOrder: number): ServicePackageCreateInput {
  return {
    name: '',
    categoryId: '',
    description: '',
    color: STAFF_COLORS[0],
    active: true,
    priceOverride: null,
    sortOrder,
  }
}

function packageToValues(pkg: ServicePackage): ServicePackageCreateInput {
  return {
    name: pkg.name,
    categoryId: pkg.categoryId ?? '',
    description: pkg.description ?? '',
    color: pkg.color ?? STAFF_COLORS[0],
    active: pkg.active,
    priceOverride: pkg.priceOverride,
    sortOrder: pkg.sortOrder,
  }
}

function formatTomans(price: number) {
  if (price <= 0) return 'قیمت وارد نشده'
  return `${toPersianDigits(price.toLocaleString('fa-IR'))} تومان`
}

function packageComponentsDirty(initialIds: string[], currentIds: string[]) {
  return (
    initialIds.length !== currentIds.length ||
    initialIds.some((id, index) => id !== currentIds[index])
  )
}

export function ServicePackageManager({
  services,
  categories,
  staff,
  onChanged,
}: ServicePackageManagerProps) {
  const packagesQuery = useQuery(servicePackagesListQueryOptions())
  const packages = packagesQuery.data ?? []
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(
    null,
  )

  const nextSortOrder =
    packages.reduce((max, pkg) => Math.max(max, pkg.sortOrder), 0) + 10
  const activeCount = packages.filter((pkg) => pkg.active).length
  const errorMessage = packagesQuery.error
    ? getMutationErrorMessage(packagesQuery.error, 'خواندن پکیج‌ها انجام نشد')
    : null

  const openNew = () => {
    setSelectedPackage(null)
    setDrawerOpen(true)
  }

  const openEdit = (pkg: ServicePackage) => {
    setSelectedPackage(pkg)
    setDrawerOpen(true)
  }

  return (
    <>
      <Card className="gap-0 border-border/50 bg-card/95 py-0">
        <div className="space-y-4 px-2 py-2 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold sm:text-base">
                پکیج‌های خدمات
              </CardTitle>
              <p className="hidden text-xs leading-5 text-muted-foreground sm:block">
                تعریف پکیج، اجزای آن و قیمت نهایی را مدیریت کنید.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center sm:min-w-48 sm:gap-2">
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(packages.length)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  کل
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background px-1.5 py-1 sm:px-2 sm:py-2">
                <p className="text-xs font-bold tabular-nums sm:text-sm">
                  {toPersianDigits(activeCount)}
                </p>
                <p className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
                  فعال
                </p>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full justify-center gap-1 touch-manipulation sm:w-auto"
            onClick={openNew}
            disabled={services.length === 0}
          >
            <PackagePlus className="h-4 w-4" />
            پکیج جدید
          </Button>
          {errorMessage && (
            <p className="text-xs text-destructive">{errorMessage}</p>
          )}
        </div>
        <div className="space-y-2 px-2 pb-2 sm:space-y-3 sm:px-4 sm:pb-4">
          {packagesQuery.isPending ? (
            <div className="flex items-center justify-center rounded-lg border border-border/60 bg-background py-8">
              <Spinner />
            </div>
          ) : packages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-center sm:px-4 sm:py-8">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PackagePlus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">هنوز پکیجی ثبت نشده.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                چند خدمت را به عنوان یک تعریف قابل رزرو کنار هم قرار دهید.
              </p>
            </div>
          ) : (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 sm:px-3 sm:py-2.5"
              >
                <div
                  className="h-8 w-1.5 shrink-0 rounded-full sm:h-10"
                  style={{
                    backgroundColor: `var(--calendar-${normalizeCalendarColorId(pkg.color)})`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{pkg.name}</p>
                    {!pkg.active && (
                      <Badge variant="secondary" className="text-[10px]">
                        غیرفعال
                      </Badge>
                    )}
                    {pkg.categoryName && (
                      <Badge variant="outline" className="text-[10px]">
                        {pkg.categoryName}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:gap-1.5 sm:text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
                      <Clock3 className="h-3 w-3" />
                      {toPersianDigits(pkg.totalDuration)} دقیقه
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
                      <Banknote className="h-3 w-3" />
                      {formatTomans(pkg.resolvedPrice)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 sm:px-2">
                      {toPersianDigits(pkg.components.length)} جزء
                    </span>
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9"
                  aria-label={`ویرایش پکیج ${pkg.name}`}
                  onClick={() => openEdit(pkg)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
      <ServicePackageDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open)
          if (!open) setSelectedPackage(null)
        }}
        pkg={selectedPackage}
        services={services}
        categories={categories}
        staff={staff}
        nextSortOrder={nextSortOrder}
        onSuccess={() => {
          setDrawerOpen(false)
          setSelectedPackage(null)
          onChanged()
        }}
      />
    </>
  )
}

function ServicePackageDrawer({
  open,
  onOpenChange,
  pkg,
  services,
  categories,
  staff,
  nextSortOrder,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pkg: ServicePackage | null
  services: Service[]
  categories: ServiceCategory[]
  staff: User[]
  nextSortOrder: number
  onSuccess: () => void
}) {
  const isEditing = Boolean(pkg)
  const [componentIds, setComponentIds] = useState<string[]>([])
  const [initialComponentIds, setInitialComponentIds] = useState<string[]>([])
  const [staffIds, setStaffIds] = useState<string[]>([])
  const [initialStaffIds, setInitialStaffIds] = useState<string[]>([])

  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ServicePackageCreateInput>({
    resolver: zodResolver(servicePackageCreateSchema),
    defaultValues: emptyPackageValues(nextSortOrder),
  })
  const nameValue = useWatch({ control, name: 'name' })
  const savePackage = useSaveServicePackageMutation(pkg?.id)
  const saveComponents = useSaveServicePackageComponentsMutation(pkg?.id)
  const saveStaff = useSaveServicePackageStaffMutation(pkg?.id)

  useEffect(() => {
    if (!open) return
    reset(pkg ? packageToValues(pkg) : emptyPackageValues(nextSortOrder))
    const nextComponentIds =
      pkg?.components.map((component) => component.serviceId) ?? []
    setComponentIds(nextComponentIds)
    setInitialComponentIds(nextComponentIds)
    const nextStaffIds = pkg?.staffIds ?? []
    setStaffIds(nextStaffIds)
    setInitialStaffIds(nextStaffIds)
  }, [nextSortOrder, open, pkg, reset])

  const selectedComponents = componentIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is Service => Boolean(service))
  const componentTotals = selectedComponents.reduce(
    (sum, service) => ({
      duration: sum.duration + service.duration,
      price: sum.price + service.price,
    }),
    { duration: 0, price: 0 },
  )
  const componentsDirty = packageComponentsDirty(
    initialComponentIds,
    componentIds,
  )
  const staffDirty = packageComponentsDirty(initialStaffIds, staffIds)
  const saving =
    isSubmitting ||
    savePackage.isPending ||
    saveComponents.isPending ||
    saveStaff.isPending

  const toggleStaff = (staffId: string, checked: boolean) => {
    setStaffIds((current) => {
      if (checked) {
        return current.includes(staffId) ? current : [...current, staffId]
      }
      return current.filter((id) => id !== staffId)
    })
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await savePackage.mutateAsync(values)
      const packageId = pkg?.id ?? saved.id
      if (componentIds.length > 0 || componentsDirty || !pkg) {
        await saveComponents.mutateAsync({
          packageId,
          serviceIds: componentIds,
        })
      }
      if (staffDirty || !pkg) {
        await saveStaff.mutateAsync({
          packageId,
          staffIds,
        })
      }
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: (isDirty || componentsDirty || staffDirty) && !saving,
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
            {isEditing ? 'ویرایش پکیج' : 'پکیج جدید'}
          </FormSheetTitle>
          <FormSheetDescription>
            تعریف پکیج و اجزا را تنظیم کنید
          </FormSheetDescription>
        </FormSheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
          onFocus={handleFormFocusScroll}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pkg-name">نام پکیج</FieldLabel>
              <Input id="pkg-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>بخش</FieldLabel>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={
                      field.value ? String(field.value) : NO_CATEGORY_VALUE
                    }
                    onValueChange={(value) =>
                      field.onChange(value === NO_CATEGORY_VALUE ? '' : value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="بدون بخش" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY_VALUE}>
                        بدون بخش
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>قیمت پکیج</FieldLabel>
                <Controller
                  control={control}
                  name="priceOverride"
                  render={({ field }) => (
                    <LocalizedNumberInput
                      value={field.value}
                      onValueChange={(value) =>
                        field.onChange(value === '' ? null : value)
                      }
                      onBlur={() => {
                        field.onBlur()
                        void trigger('priceOverride')
                      }}
                      placeholder="جمع اجزا"
                    />
                  )}
                />
                {errors.priceOverride && (
                  <FieldError>{errors.priceOverride.message}</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel>ترتیب نمایش</FieldLabel>
                <Controller
                  control={control}
                  name="sortOrder"
                  render={({ field }) => (
                    <LocalizedNumberInput
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
            <Field>
              <FieldLabel htmlFor="pkg-description">توضیح کوتاه</FieldLabel>
              <Textarea
                id="pkg-description"
                rows={3}
                {...register('description')}
              />
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
                <FieldLabel>رنگ</FieldLabel>
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
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">اجزای پکیج</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {toPersianDigits(componentTotals.duration)} دقیقه ·{' '}
                    {formatTomans(componentTotals.price)}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {toPersianDigits(componentIds.length)} جزء
                </Badge>
              </div>
              <ServicePicker
                services={services}
                value=""
                onChange={(serviceId) =>
                  setComponentIds((current) =>
                    current.includes(serviceId)
                      ? current
                      : [...current, serviceId],
                  )
                }
                placeholder="افزودن خدمت"
                getDisabledReason={(service) =>
                  componentIds.includes(service.id) ? 'انتخاب شده' : null
                }
              />
              {selectedComponents.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedComponents.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {service.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {toPersianDigits(service.duration)} دقیقه ·{' '}
                          {formatTomans(service.price)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`حذف ${service.name} از پکیج`}
                        onClick={() =>
                          setComponentIds((current) =>
                            current.filter((id) => id !== service.id),
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-background px-3 py-3 text-xs text-muted-foreground">
                  <Plus className="h-4 w-4" />
                  هنوز خدمتی به پکیج اضافه نشده است.
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">پرسنل مجاز</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    فقط این پرسنل می‌توانند برای پکیج نوبت بگیرند.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {toPersianDigits(staffIds.length)} نفر
                </Badge>
              </div>
              {staff.length > 0 ? (
                <div className="space-y-1.5">
                  {staff.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-2 text-sm"
                    >
                      <Checkbox
                        checked={staffIds.includes(member.id)}
                        onCheckedChange={(checked) =>
                          toggleStaff(member.id, checked === true)
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {member.name}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border/70 bg-background px-3 py-3 text-xs text-muted-foreground">
                  هنوز پرسنلی ثبت نشده است.
                </p>
              )}
            </div>
          </FieldGroup>
        </form>
        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={saving || !nameValue || componentIds.length === 0}
            className="touch-manipulation"
          >
            {saving && <Spinner className="ms-2" />}
            {saving ? '…' : isEditing ? 'ذخیره' : 'افزودن'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={saving}
          >
            انصراف
          </Button>
        </FormSheetFooter>
      </FormSheetContent>
      {confirmDialog}
    </FormSheet>
  )
}
