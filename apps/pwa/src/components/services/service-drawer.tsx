import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  FormSheet,
  FormSheetContent,
  FormSheetHeader,
  FormSheetTitle,
  FormSheetDescription,
  FormSheetFooter,
} from '#/components/form-sheet'
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'
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
import type { Service, ServiceCategory } from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { calendarColorOptions } from '@repo/brand-tokens/calendar-colors'
import { serviceFormSchema } from '@repo/salon-core/forms/service'
import type { ServiceFormInput } from '@repo/salon-core/forms/service'
import { useSaveServiceMutation } from '#/lib/services-queries'
import { LocalizedNumberInput } from '#/components/localized-number-input'

interface ServiceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
  categories: ServiceCategory[]
  defaultCategoryId?: string | null
  onSuccess: () => void
}

function emptyValues(defaultCategoryId?: string | null): ServiceFormInput {
  return {
    name: '',
    categoryId: defaultCategoryId ?? '',
    category: 'hair',
    duration: 45,
    price: 0,
    color: STAFF_COLORS[0],
    active: true,
    description: '',
  }
}

function serviceToFormValues(service: Service): ServiceFormInput {
  return {
    name: service.name,
    categoryId: service.categoryId,
    category: service.category,
    duration: service.duration,
    price: service.price,
    color: normalizeCalendarColorId(service.color),
    active: service.active,
    description: service.description ?? '',
  }
}

export function ServiceDrawer({
  open,
  onOpenChange,
  service,
  categories,
  defaultCategoryId,
  onSuccess,
}: ServiceDrawerProps) {
  const isEditing = !!service
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    trigger,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ServiceFormInput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: emptyValues(defaultCategoryId),
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (!open) return
    if (service) {
      reset(serviceToFormValues(service))
      return
    }
    reset(emptyValues(defaultCategoryId ?? categories[0]?.id))
  }, [categories, defaultCategoryId, open, reset, service])

  const nameValue = useWatch({ control, name: 'name' })
  const categoryValue = useWatch({ control, name: 'categoryId' })
  const saveService = useSaveServiceMutation(service?.id)

  const onSubmit = handleSubmit(async (values) => {
    const payload = serviceFormSchema.safeParse(values)
    if (payload.success && !payload.data.categoryId) {
      setError('categoryId', { message: 'بخش خدمات را انتخاب کنید' })
      return
    }
    try {
      await saveService.mutateAsync({ values })
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
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
          onFocus={handleFormFocusScroll}
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
                {errors.color && (
                  <FieldError>{errors.color.message}</FieldError>
                )}
              </Field>
            </div>
          </FieldGroup>
        </form>

        <FormSheetFooter>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !nameValue || !categoryValue}
            className="touch-manipulation"
          >
            {isSubmitting && <Spinner className="ms-2" />}
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
