import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
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
import { useDismissGuard } from '#/lib/use-dismiss-guard'
import { useKeyboardInset } from '#/lib/use-keyboard-inset'
import { serviceFamilyFormSchema } from '@repo/salon-core/forms/service'
import type { ServiceFamilyCreateInput } from '@repo/salon-core/forms/service'
import type { ServiceCategory, ServiceFamily } from '@repo/salon-core/types'
import { useSaveServiceFamilyMutation } from '#/lib/services-queries'

interface ServiceFamilyDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  family: ServiceFamily | null
  categories: ServiceCategory[]
  defaultCategoryId?: string | null
  onSuccess: () => void
}

function emptyValues(
  defaultCategoryId?: string | null,
): ServiceFamilyCreateInput {
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
  const isEditing = !!family
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ServiceFamilyCreateInput>({
    resolver: zodResolver(serviceFamilyFormSchema),
    defaultValues: emptyValues(defaultCategoryId),
  })

  useEffect(() => {
    if (!open) return
    reset(
      family
        ? {
            categoryId: family.categoryId,
            name: family.name,
            active: family.active,
          }
        : emptyValues(defaultCategoryId ?? categories[0]?.id),
    )
  }, [categories, defaultCategoryId, family, open, reset])

  const nameValue = useWatch({ control, name: 'name' })
  const categoryValue = useWatch({ control, name: 'categoryId' })

  const saveFamily = useSaveServiceFamilyMutation(family?.id)

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveFamily.mutateAsync(values)
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
            {isEditing ? 'ویرایش گروه خدمات' : 'گروه خدمات جدید'}
          </DrawerTitle>
          <DrawerDescription>
            خدمات مشابه را در یک گروه بگذارید
          </DrawerDescription>
        </DrawerHeader>
        <form
          onSubmit={onSubmit}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          <FieldGroup>
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
            <Field>
              <FieldLabel htmlFor="service-family-name">نام گروه</FieldLabel>
              <Input id="service-family-name" {...register('name')} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
          </FieldGroup>
        </form>
        <DrawerFooter>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !nameValue || !categoryValue}
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
        </DrawerFooter>
      </DrawerContent>
      {confirmDialog}
    </Drawer>
  )
}
