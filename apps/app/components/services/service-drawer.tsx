'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Textarea } from '@repo/ui/textarea'
import { Field, FieldLabel, FieldGroup, FieldError } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import {
  Service,
  ServiceCategory,
  ServiceFamily,
  STAFF_COLORS,
} from '@repo/salon-core/types'
import { normalizeCalendarColorId } from '@repo/salon-core/calendar-colors'
import { calendarColorOptions } from '@repo/brand-tokens/calendar-colors'
import {
  parseLocalizedInt,
  toPersianDigits,
} from '@repo/salon-core/persian-digits'
import {
  serviceFormSchema,
  type ServiceFormInput,
} from '@repo/salon-core/forms/service'
import { DataClientHttpError } from '@repo/data-client'
import { useManagerDataClient } from '@/components/manager-data-client-provider'

interface ServiceDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
  categories: ServiceCategory[]
  families: ServiceFamily[]
  defaultFamilyId?: string | null
  onSuccess: () => void
}

function emptyValues(defaultFamilyId?: string | null): ServiceFormInput {
  return {
    name: '',
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
  categories,
  families,
  defaultFamilyId,
  onSuccess,
}: ServiceDrawerProps) {
  const dc = useManagerDataClient()
  const isEditing = !!service
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormInput>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: emptyValues(defaultFamilyId),
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (!open) return
    reset(service ? serviceToFormValues(service) : emptyValues(defaultFamilyId ?? families[0]?.id))
  }, [defaultFamilyId, families, open, reset, service])

  const nameValue = useWatch({ control, name: 'name' })
  const familyValue = useWatch({ control, name: 'familyId' })

  const onSubmit = handleSubmit(async (values) => {
    if (!dc) {
      setError('root', { message: 'اتصال داده برقرار نیست' })
      return
    }

    try {
      const payload = serviceFormSchema.parse(values)
      if (!payload.familyId) {
        setError('familyId', { message: 'خانواده خدمت را انتخاب کنید' })
        return
      }
      if (isEditing) {
        await dc.services.update(service.id, {
          ...payload,
          color: normalizeCalendarColorId(payload.color),
        })
      } else {
        await dc.services.create({
          ...payload,
          color: normalizeCalendarColorId(payload.color),
        })
      }
      onSuccess()
    } catch (err) {
      const msg =
        err instanceof DataClientHttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'خطایی رخ داد'
      setError('root', { message: msg })
    }
  })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditing ? 'ویرایش خدمت' : 'خدمت جدید'}</DrawerTitle>
          <DrawerDescription>نام، مدت و قیمت را مشخص کنید</DrawerDescription>
        </DrawerHeader>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 overflow-auto px-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="svc-name">نام خدمت</FieldLabel>
              <Input id="svc-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>خانواده خدمت</FieldLabel>
              <Controller
                control={control}
                name="familyId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="انتخاب خانواده خدمت" />
                    </SelectTrigger>
                    <SelectContent>
                      {families.map((family) => {
                        const categoryName =
                          family.categoryName ??
                          categories.find((category) => category.id === family.categoryId)?.name
                        return (
                          <SelectItem key={family.id} value={family.id}>
                            {categoryName ? `${categoryName} / ${family.name}` : family.name}
                          </SelectItem>
                        )
                      })}
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
                    <Input
                      id="svc-dur"
                      type="text"
                      inputMode="numeric"
                      value={toPersianDigits(field.value)}
                      onChange={(e) =>
                        field.onChange(
                          Math.max(
                            5,
                            parseLocalizedInt(
                              e.target.value,
                              Number(field.value) || 45,
                            ),
                          ),
                        )
                      }
                      onBlur={field.onBlur}
                      dir="rtl"
                      className="text-right tabular-nums"
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
                    <Input
                      id="svc-price"
                      type="text"
                      inputMode="numeric"
                      value={toPersianDigits(field.value)}
                      onChange={(e) =>
                        field.onChange(
                          Math.max(
                            0,
                            parseLocalizedInt(
                              e.target.value,
                              Number(field.value) || 0,
                            ),
                          ),
                        )
                      }
                      onBlur={field.onBlur}
                      dir="rtl"
                      className="text-right tabular-nums"
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
              <Textarea id="svc-description" rows={3} {...register('description')} />
              {errors.description && <FieldError>{errors.description.message}</FieldError>}
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
                      onValueChange={(v) => field.onChange(v as ServiceFormInput['kind'])}
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
            <FormRootError message={errors.root?.message} />
          </FieldGroup>
        </form>

        <DrawerFooter>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !nameValue || !familyValue}
            className="touch-manipulation"
          >
            {isSubmitting && <Spinner className="ml-2" />}
            {isSubmitting ? '…' : isEditing ? 'ذخیره' : 'افزودن'}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">انصراف</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
