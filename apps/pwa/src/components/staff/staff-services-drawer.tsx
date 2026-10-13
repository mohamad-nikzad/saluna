import { useEffect, useMemo, useState } from 'react'
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
import { SearchInput } from '@repo/ui/search-input'
import type { User, Service } from '@repo/salon-core/types'
import { staffServiceIdsSchema } from '@repo/salon-core/forms/staff'
import type { StaffServiceIdsInput } from '@repo/salon-core/forms/staff'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { normalizePersianSearch } from '@repo/salon-core/iran-locations'
import { cn } from '@repo/ui/utils'
import { serviceCategoryName } from '@repo/salon-core/service-catalog'
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
    clearErrors,
    getValues,
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
  const [search, setSearch] = useState('')
  const query = normalizePersianSearch(search)

  const activeServices = useMemo(
    () => services.filter((s) => s.active),
    [services],
  )

  const matchingServices = useMemo(
    () =>
      activeServices.filter(
        (service) =>
          normalizePersianSearch(service.name).includes(query) ||
          normalizePersianSearch(serviceCategoryName(service)).includes(query),
      ),
    [activeServices, query],
  )

  const serviceGroups = useMemo(
    () => groupStaffServicesByCategory(matchingServices),
    [matchingServices],
  )

  useEffect(() => {
    if (!open || !staff) return
    reset({ serviceIds: staff.serviceIds ?? null })
    setSearch('')
  }, [open, reset, staff])

  const toggleService = (serviceId: string, checked: boolean) => {
    clearErrors('root')
    const next = new Set(selected)
    if (checked) next.add(serviceId)
    else next.delete(serviceId)
    setValue('serviceIds', [...next], {
      shouldDirty: true,
      shouldValidate: false,
    })
  }

  const toggleServices = (scope: Service[], checked: boolean) => {
    const next = new Set(selected)
    for (const service of scope) {
      if (checked) next.add(service.id)
      else next.delete(service.id)
    }
    clearErrors('root')
    setValue('serviceIds', [...next], {
      shouldDirty: true,
      shouldValidate: false,
    })
  }

  const handleUnrestrictedChange = (checked: boolean) => {
    clearErrors('root')
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

  const handleSave = () => {
    // The shared payload schema normalizes [] to null. Validate the draft
    // before parsing so deselect-all cannot grant unrestricted access.
    const draftIds = getValues('serviceIds')
    if (draftIds != null && draftIds.length === 0) {
      setError('root', {
        message:
          'حداقل یک خدمت انتخاب کنید، یا حالت «همه خدمات» را فعال بگذارید.',
      })
      return
    }

    return handleSubmit(async (values) => {
      if (!staff) return
      try {
        await saveServices.mutateAsync({
          staffId: staff.id,
          serviceIds: values.serviceIds ?? null,
        })
        onSuccess()
      } catch {
        // Toast handled by mutation cache.
      }
    })()
  }

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
        <DrawerHeader className="shrink-0 px-4 pb-3 text-start md:text-start">
          <DrawerTitle className="text-start">خدمات مجاز</DrawerTitle>
          <DrawerDescription className="text-start">
            {staff?.name ?? 'یک پرسنل را انتخاب کنید.'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 py-3">
          <label
            htmlFor="staff-svc-unrestricted"
            className="grid min-h-11 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
          >
            <span className="min-w-0">
              <span
                id="staff-svc-unrestricted-label"
                className="block text-sm font-medium"
              >
                همه خدمات فعال
              </span>
              <span className="block text-xs text-muted-foreground">
                شامل خدمات جدید
              </span>
            </span>
            <span dir="ltr" className="inline-flex shrink-0">
              <Switch
                id="staff-svc-unrestricted"
                aria-labelledby="staff-svc-unrestricted-label"
                checked={unrestricted}
                onCheckedChange={handleUnrestrictedChange}
                disabled={!staff || isSubmitting}
              />
            </span>
          </label>

          {!unrestricted && (
            <>
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جستجوی خدمت یا دسته‌بندی"
                aria-label="جستجوی نام خدمت یا دسته‌بندی"
                clearable
                disabled={isSubmitting}
              />
              <div className="space-y-2">
                <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                  <p role="status">
                    {toPersianDigits(selected.size)} خدمت انتخاب شده
                  </p>
                  <p>{query ? 'نتایج جستجو' : 'همه خدمات فعال'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-0 px-2"
                    aria-label={
                      query ? 'انتخاب همه نتایج جستجو' : 'انتخاب همه خدمات فعال'
                    }
                    onClick={() => toggleServices(matchingServices, true)}
                    disabled={
                      matchingServices.length === 0 || isSubmitting || !staff
                    }
                  >
                    انتخاب همه
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-0 px-2"
                    aria-label={
                      query
                        ? 'لغو انتخاب نتایج جستجو'
                        : 'لغو انتخاب همه خدمات فعال'
                    }
                    onClick={() => toggleServices(matchingServices, false)}
                    disabled={
                      matchingServices.length === 0 || isSubmitting || !staff
                    }
                  >
                    لغو انتخاب همه
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
                {matchingServices.length === 0 && (
                  <p className="py-3 text-sm text-muted-foreground">
                    {query
                      ? 'خدمتی با این جستجو پیدا نشد.'
                      : 'هیچ خدمت فعالی وجود ندارد.'}
                  </p>
                )}
                {serviceGroups.map((category) => {
                  const selectedCount = category.services.filter((service) =>
                    selected.has(service.id),
                  ).length
                  const groupChecked =
                    selectedCount === category.services.length
                      ? true
                      : selectedCount > 0
                        ? 'indeterminate'
                        : false
                  return (
                    <div key={category.categoryId} className="min-w-0">
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border/60 px-1 text-xs font-semibold text-muted-foreground">
                        <Checkbox
                          className="shrink-0"
                          aria-label={
                            query
                              ? `خدمات نتایج جستجوی دسته ${category.categoryName}`
                              : `همه خدمات دسته ${category.categoryName}`
                          }
                          checked={groupChecked}
                          disabled={isSubmitting || !staff}
                          onCheckedChange={(value) =>
                            toggleServices(category.services, value === true)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          {category.categoryName}
                        </span>
                      </label>
                      {category.services.map((svc) => (
                        <label
                          key={svc.id}
                          className={cn(
                            'flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-md px-1 py-2 text-sm transition-colors',
                            'hover:bg-accent/40',
                          )}
                        >
                          <Checkbox
                            className="shrink-0"
                            aria-label={svc.name}
                            checked={selected.has(svc.id)}
                            disabled={isSubmitting || !staff}
                            onCheckedChange={(v) =>
                              toggleService(svc.id, v === true)
                            }
                          />
                          <span className="min-w-0 flex-1 leading-snug">
                            {svc.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="shrink-0 border-t border-border/60 bg-background px-4">
          <FormRootError message={errors.root?.message} role="alert" />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="lg"
              onClick={() => void handleSave()}
              disabled={isSubmitting || !staff}
              className="min-w-0 touch-manipulation"
            >
              {isSubmitting && <Spinner />}
              {isSubmitting ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              type="button"
              className="min-w-0"
              onClick={() => requestClose(false)}
              disabled={isSubmitting}
            >
              انصراف
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
      {confirmDialog}
    </Drawer>
  )
}
