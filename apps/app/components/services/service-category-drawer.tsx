'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { Spinner } from '@repo/ui/spinner'
import {
  serviceCategoryFormSchema,
  type ServiceCategoryCreateInput,
} from '@repo/salon-core/forms/service'
import type { ServiceCategory } from '@repo/salon-core/types'
import { DataClientHttpError } from '@repo/data-client'
import { useManagerDataClient } from '@/components/manager-data-client-provider'

interface ServiceCategoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: ServiceCategory | null
  onSuccess: () => void
}

function emptyValues(): ServiceCategoryCreateInput {
  return { name: '', active: true }
}

export function ServiceCategoryDrawer({
  open,
  onOpenChange,
  category,
  onSuccess,
}: ServiceCategoryDrawerProps) {
  const dc = useManagerDataClient()
  const isEditing = !!category
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceCategoryCreateInput>({
    resolver: zodResolver(serviceCategoryFormSchema),
    defaultValues: emptyValues(),
  })

  useEffect(() => {
    if (!open) return
    reset(category ? { name: category.name, active: category.active } : emptyValues())
  }, [category, open, reset])

  const nameValue = useWatch({ control, name: 'name' })

  const onSubmit = handleSubmit(async (values) => {
    if (!dc) {
      setError('root', { message: 'اتصال داده برقرار نیست' })
      return
    }
    try {
      const payload = serviceCategoryFormSchema.parse(values)
      if (isEditing) {
        await dc.services.categories.update(category.id, payload)
      } else {
        await dc.services.categories.create(payload)
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
          <DrawerTitle>{isEditing ? 'ویرایش دسته' : 'دسته جدید'}</DrawerTitle>
          <DrawerDescription>نام سطح اصلی کاتالوگ خدمات را وارد کنید</DrawerDescription>
        </DrawerHeader>
        <form onSubmit={onSubmit} className="px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="service-category-name">نام دسته</FieldLabel>
              <Input id="service-category-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <FormRootError message={errors.root?.message} />
          </FieldGroup>
        </form>
        <DrawerFooter>
          <Button onClick={onSubmit} disabled={isSubmitting || !nameValue}>
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
