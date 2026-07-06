import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@repo/ui/drawer'
import { Button } from '@repo/ui/button'
import { FormRootError } from '@repo/ui/form'
import { Checkbox } from '@repo/ui/checkbox'
import { Switch } from '@repo/ui/switch'
import { Spinner } from '@repo/ui/spinner'
import type { User, Service } from '@repo/salon-core/types'
import { staffServiceIdsSchema } from '@repo/salon-core/forms/staff'
import type { StaffServiceIdsInput } from '@repo/salon-core/forms/staff'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { cn } from '@repo/ui/utils'
import { serviceCategoryName } from '#/components/services/service-catalog-groups'
import { useUpdateStaffServicesMutation } from '#/lib/staff-queries'
import { useDismissGuard } from '#/lib/use-dismiss-guard'

interface StaffServicesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: User | null
  services: Service[]
  onSuccess: () => void
}

type StaffServiceCategoryGroup = {
  categoryId: string
  categoryName: string
  services: Service[]
}

function groupStaffServicesByCategory(
  services: Service[],
): StaffServiceCategoryGroup[] {
  const categoryMap = new Map<string, StaffServiceCategoryGroup>()

  for (const service of services) {
    const categoryId = service.categoryId || service.category
    const categoryName = serviceCategoryName(service)
    const categoryGroup = categoryMap.get(categoryId) ?? {
      categoryId,
      categoryName,
      services: [],
    }
    categoryGroup.services.push(service)
    categoryMap.set(categoryId, categoryGroup)
  }

  return [...categoryMap.values()]
    .map((category) => ({
      ...category,
      services: category.services.sort((a, b) =>
        a.name.localeCompare(b.name, 'fa'),
      ),
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'fa'))
}

export function StaffServicesDrawer({
  open,
  onOpenChange,
  staff,
  services,
  onSuccess,
}: StaffServicesDrawerProps) {
  const {
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StaffServiceIdsInput>({
    resolver: zodResolver(staffServiceIdsSchema),
    defaultValues: { serviceIds: null },
  })
  const serviceIds = watch('serviceIds')
  const selected = useMemo(() => new Set(serviceIds ?? []), [serviceIds])
  const unrestricted = serviceIds == null

  const activeServices = useMemo(
    () => services.filter((s) => s.active),
    [services],
  )

  const serviceGroups = useMemo(
    () => groupStaffServicesByCategory(activeServices),
    [activeServices],
  )

  useEffect(() => {
    if (!open || !staff) return
    reset({ serviceIds: staff.serviceIds ?? null })
  }, [open, reset, staff])

  const toggleService = (serviceId: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(serviceId)
    else next.delete(serviceId)
    setValue('serviceIds', [...next], {
      shouldDirty: true,
      shouldValidate: false,
    })
  }

  const handleUnrestrictedChange = (checked: boolean) => {
    if (checked) {
      setValue('serviceIds', null, { shouldDirty: true })
      return
    }
    setValue(
      'serviceIds',
      selected.size === 0 ? activeServices.map((s) => s.id) : [...selected],
      {
        shouldDirty: true,
        shouldValidate: false,
      },
    )
  }

  const saveServices = useUpdateStaffServicesMutation()

  const handleSave = handleSubmit(async (values) => {
    if (!staff) return
    if (values.serviceIds != null && values.serviceIds.length === 0) {
      setError('root', {
        message:
          'حداقل یک خدمت انتخاب کنید، یا حالت «همه خدمات» را فعال بگذارید.',
      })
      return
    }

    try {
      await saveServices.mutateAsync({
        staffId: staff.id,
        serviceIds: values.serviceIds ?? null,
      })
      onSuccess()
    } catch {
      // Toast handled by mutation cache.
    }
  })

  const { requestClose, confirmDialog } = useDismissGuard({
    isDirty: isDirty && !isSubmitting,
    onClose: () => {
      reset({ serviceIds: null })
      onOpenChange(false)
    },
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      onOpenChange(true)
      return
    }
    requestClose(false)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="box-border flex min-h-0 max-h-[80dvh] w-full flex-col overflow-hidden">
        <DrawerHeader className="shrink-0 text-start md:text-start">
          <DrawerTitle className="text-start">خدمات مجاز</DrawerTitle>
          <DrawerDescription className="text-start text-pretty leading-relaxed">
            {staff ? (
              <>
                <span className="font-medium text-foreground">
                  {staff.name}
                </span>
                {' — '}
                مشخص کنید این پرسنل کدام خدمات را انجام می‌دهد. اگر محدودیتی
                نباشد، همه خدمات فعال برایشان در نوبت‌گیری در نظر گرفته می‌شود.
              </>
            ) : (
              'یک پرسنل را انتخاب کنید.'
            )}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-4">
          <div className="flex w-full min-w-0 max-w-full flex-col gap-4">
            {/*
              Always stack (no side-by-side row): RTL + Switch dir="ltr" in a flex row
              causes min-width bugs and horizontal overflow on mobile.
            */}
            <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card p-4">
              <div className="flex w-full min-w-0 max-w-full flex-col gap-3">
                <div className="w-full min-w-0 max-w-full space-y-1.5">
                  <p
                    className="text-sm font-medium leading-snug break-words"
                    id="staff-svc-unrestricted-label"
                  >
                    همه خدمات فعال
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed break-words">
                    اگر این گزینه روشن باشد، پرسنل می‌تواند هر خدمت فعال را
                    انجام دهد. اگر خاموش باشد، فقط خدمات تیک‌خورده مجاز است.
                  </p>
                </div>
                <div
                  className="flex w-full min-w-0 justify-start pt-1"
                  dir="rtl"
                >
                  <div dir="ltr" className="inline-flex shrink-0">
                    <Switch
                      id="staff-svc-unrestricted"
                      aria-labelledby="staff-svc-unrestricted-label"
                      checked={unrestricted}
                      onCheckedChange={handleUnrestrictedChange}
                      disabled={!staff}
                    />
                  </div>
                </div>
              </div>
            </div>

            {!unrestricted && (
              <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-3">
                {serviceGroups.map((category) => (
                  <div key={category.categoryId} className="min-w-0">
                    <p className="mb-2 text-xs font-semibold text-foreground">
                      {category.categoryName}
                    </p>
                    <div className="flex flex-col gap-2">
                      {category.services.map((svc) => (
                        <label
                          key={svc.id}
                          className={cn(
                            'flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 text-sm transition-colors',
                            'hover:bg-accent/40',
                          )}
                        >
                          <span className="min-w-0 flex-1 leading-snug">
                            {svc.name}
                            <span className="text-muted-foreground text-xs">
                              {' '}
                              · {toPersianDigits(svc.duration)} دقیقه
                            </span>
                          </span>
                          <Checkbox
                            className="mt-0.5 shrink-0"
                            checked={selected.has(svc.id)}
                            onCheckedChange={(v) =>
                              toggleService(svc.id, v === true)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <FormRootError message={errors.root?.message} />
          </div>
        </div>

        <DrawerFooter className="shrink-0 border-t border-border/60 bg-background">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSubmitting || !staff}
            className="touch-manipulation"
          >
            {isSubmitting && <Spinner className="ms-2" />}
            {isSubmitting ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
          <Button
            variant="outline"
            type="button"
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
