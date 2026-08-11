import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Percent, Trash2 } from 'lucide-react'
import type { Service } from '@repo/salon-core/types'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'

import {
  formatLocalizedNumberInput,
  normalizeLocalizedDecimalInput,
} from '#/components/localized-number-input'
import { StaffDetailSection } from '#/components/staff/staff-detail-section'
import {
  staffCommissionReportQueryOptions,
  useDeleteServiceCommissionOverrideMutation,
  useDisableCommissionAgreementMutation,
  useSaveCommissionAgreementMutation,
  useSaveServiceCommissionOverrideMutation,
  type CommissionPeriodQuery,
} from '#/lib/commission-queries'
import { CommissionPeriodControls } from './commission-period-controls'
import { StaffCommissionReportView } from './staff-commission-report-view'

export function ManagerStaffCommissionPanel({
  staffId,
  services,
}: {
  staffId: string
  services: Service[]
}) {
  const [period, setPeriod] = useState<CommissionPeriodQuery>({
    period: 'today',
  })
  const [overrideServiceId, setOverrideServiceId] = useState('')
  const reportQuery = useQuery(
    staffCommissionReportQueryOptions(staffId, period),
  )
  const saveAgreement = useSaveCommissionAgreementMutation()
  const disableAgreement = useDisableCommissionAgreementMutation()
  const saveOverride = useSaveServiceCommissionOverrideMutation()
  const deleteOverride = useDeleteServiceCommissionOverrideMutation()
  const agreement = reportQuery.data?.agreement
  const overrides = agreement?.overrides ?? []
  const availableServices = services.filter((service) => service.active)

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const percentage = Number(
      normalizeLocalizedDecimalInput(
        String(new FormData(event.currentTarget).get('percentage') ?? ''),
      ),
    )
    if (Number.isFinite(percentage)) {
      saveAgreement.mutate({ staffId, percentage })
    }
  }

  const saveOverrideForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!overrideServiceId) return
    const form = event.currentTarget
    const percentage = Number(
      normalizeLocalizedDecimalInput(
        String(new FormData(form).get('overridePercentage') ?? ''),
      ),
    )
    if (!Number.isFinite(percentage)) return
    saveOverride.mutate(
      { staffId, serviceId: overrideServiceId, percentage },
      {
        onSuccess: () => {
          setOverrideServiceId('')
          form.reset()
        },
      },
    )
  }

  return (
    <>
      <StaffDetailSection title="توافق کمیسیون" icon={Percent}>
        <form
          key={`${agreement?.percentage ?? ''}-${agreement?.active ?? false}`}
          onSubmit={save}
          className="space-y-3"
        >
          <label className="block space-y-1.5 text-xs font-bold text-foreground">
            درصد پیش‌فرض کمیسیون
            <div className="relative mt-1.5">
              <Input
                name="percentage"
                type="text"
                inputMode="decimal"
                required={true}
                defaultValue={formatLocalizedNumberInput(agreement?.percentage)}
                onChange={(event) => {
                  event.currentTarget.value = formatLocalizedNumberInput(
                    normalizeLocalizedDecimalInput(event.currentTarget.value),
                  )
                }}
                className="pl-10 text-right tabular-nums"
                aria-label="درصد پیش‌فرض کمیسیون"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ٪
              </span>
            </div>
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            تغییر درصد فقط روی نوبت‌هایی اثر دارد که بعد از ذخیره انجام شوند.
            برای خدمات خاص می‌توانید استثنا تعریف کنید.
          </p>
          <div className="flex flex-col items-start gap-2">
            <Button type="submit" size="lg" disabled={saveAgreement.isPending}>
              {agreement?.active ? 'ذخیره درصد جدید' : 'فعال‌کردن توافق'}
            </Button>
            {agreement?.active ? (
              <Button
                type="button"
                variant="outline"
                disabled={disableAgreement.isPending}
                onClick={() => disableAgreement.mutate(staffId)}
              >
                غیرفعال‌کردن
              </Button>
            ) : null}
          </div>
        </form>

        {agreement ? (
          <div className="mt-5 space-y-3 border-t border-line-soft pt-4">
            <div>
              <div className="text-xs font-bold text-foreground">
                استثناهای کمیسیون خدمت
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                اگر برای خدمتی استثنا ثبت شود، همان درصد جایگزین درصد پیش‌فرض
                می‌شود.
              </p>
            </div>

            {overrides.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-line p-3 text-[11px] text-muted-foreground">
                هنوز استثنایی ثبت نشده است.
              </div>
            ) : (
              <div className="divide-y divide-line-soft overflow-hidden rounded-[14px] border border-line-soft bg-paper">
                {overrides.map((override) => (
                  <div
                    key={override.serviceId}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-foreground">
                        {override.serviceName}
                        {!override.serviceActive ? (
                          <span className="mr-1 text-[10px] font-medium text-muted-foreground">
                            (بایگانی‌شده)
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {toPersianDigits(override.percentage)}٪
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`حذف استثنای ${override.serviceName}`}
                      disabled={deleteOverride.isPending}
                      onClick={() =>
                        deleteOverride.mutate({
                          staffId,
                          serviceId: override.serviceId,
                        })
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={saveOverrideForm} className="space-y-3">
              <label className="block space-y-1.5 text-xs font-bold text-foreground">
                خدمت
                <Select
                  value={overrideServiceId || undefined}
                  onValueChange={setOverrideServiceId}
                  disabled={availableServices.length === 0}
                >
                  <SelectTrigger className="mt-1.5 w-full" aria-label="خدمت">
                    <SelectValue placeholder="انتخاب خدمت" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-xs font-bold text-foreground">
                درصد استثنا
                <div className="relative mt-1.5">
                  <Input
                    name="overridePercentage"
                    type="text"
                    inputMode="decimal"
                    required={true}
                    disabled={!overrideServiceId}
                    onChange={(event) => {
                      event.currentTarget.value = formatLocalizedNumberInput(
                        normalizeLocalizedDecimalInput(
                          event.currentTarget.value,
                        ),
                      )
                    }}
                    className="pl-10 text-right tabular-nums"
                    aria-label="درصد استثنای کمیسیون خدمت"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ٪
                  </span>
                </div>
              </label>
              <Button
                type="submit"
                variant="outline"
                disabled={
                  !overrideServiceId ||
                  saveOverride.isPending ||
                  availableServices.length === 0
                }
              >
                {overrides.some((row) => row.serviceId === overrideServiceId)
                  ? 'ذخیره استثنا'
                  : 'افزودن استثنا'}
              </Button>
            </form>
          </div>
        ) : null}
      </StaffDetailSection>

      <StaffDetailSection title="گزارش کمیسیون" icon={Banknote}>
        <div className="space-y-3">
          <CommissionPeriodControls value={period} onChange={setPeriod} />
          {reportQuery.data ? (
            <StaffCommissionReportView report={reportQuery.data} />
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {reportQuery.isPending
                ? 'در حال دریافت گزارش…'
                : 'گزارش دریافت نشد'}
            </div>
          )}
        </div>
      </StaffDetailSection>
    </>
  )
}
