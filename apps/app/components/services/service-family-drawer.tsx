'use client'

import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { Input } from '@repo/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'
import { Spinner } from '@repo/ui/spinner'
import {
  serviceFamilyFormSchema,
  type ServiceFamilyCreateInput,
} from '@repo/salon-core/forms/service'
import type { ServiceCategory, ServiceFamily } from '@repo/salon-core/types'
import { DataClientHttpError } from '@repo/data-client'
import { useManagerDataClient } from '@/components/manager-data-client-provider'

interface ServiceFamilyDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  family: ServiceFamily | null
  categories: ServiceCategory[]
  defaultCategoryId?: string | null
  onSuccess: () => void
}

function emptyValues(defaultCategoryId?: string | null): ServiceFamilyCreateInput {
  return { categoryId: defaultCategoryId ?? '', name: '', active: true }
}

export function ServiceFamilyDrawer({
  open,
  onOpenChange,
  family,
  categories,
  defaultCategoryId,
  onSuccess,
}: ServiceFamilyDrawerProps) {
  const dc = useManagerDataClient()
  const isEditing = !!family
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFamilyCreateInput>({
    resolver: zodResolver(serviceFamilyFormSchema),
    defaultValues: emptyValues(defaultCategoryId),
  })

  useEffect(() => {
    if (!open) return
    reset(
      family
        ? { categoryId: family.categoryId, name: family.name, active: family.active }
        : emptyValues(defaultCategoryId ?? categories[0]?.id),
    )
  }, [categories, defaultCategoryId, family, open, reset])

  const nameValue = useWatch({ control, name: 'name' })
  const categoryValue = useWatch({ control, name: 'categoryId' })

  const onSubmit = handleSubmit(async (values) => {
    if (!dc) {
      setError('root', { message: 'اتصال داده برقرار نیست' })
      return
    }
    try {
      const payload = serviceFamilyFormSchema.parse(values)
      if (isEditing) {
        await dc.services.families.update(family.id, payload)
      } else {
        await dc.services.families.create(payload)
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
          <DrawerTitle>{isEditing ? 'ویرایش خانواده خدمت' : 'خانواده خدمت جدید'}</DrawerTitle>
          <DrawerDescription>خانواده خدمت را زیر یک دسته تعریف کنید</DrawerDescription>
        </DrawerHeader>
        <form onSubmit={onSubmit} className="px-4">
          <FieldGroup>
            <Field>
              <FieldLabel>دسته</FieldLabel>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="انتخاب دسته" />
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
              {errors.categoryId && <FieldError>{errors.categoryId.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="service-family-name">نام خانواده خدمت</FieldLabel>
              <Input id="service-family-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <FormRootError message={errors.root?.message} />
          </FieldGroup>
        </form>
        <DrawerFooter>
          <Button onClick={onSubmit} disabled={isSubmitting || !nameValue || !categoryValue}>
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
