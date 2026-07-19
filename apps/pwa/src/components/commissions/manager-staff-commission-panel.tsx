import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Percent } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'

import {
  formatLocalizedNumberInput,
  normalizeLocalizedDecimalInput,
} from '#/components/localized-number-input'
import { StaffDetailSection } from '#/components/staff/staff-detail-section'
import {
  staffCommissionReportQueryOptions,
  useDisableCommissionAgreementMutation,
  useSaveCommissionAgreementMutation,
  type CommissionPeriodQuery,
} from '#/lib/commission-queries'
import { CommissionPeriodControls } from './commission-period-controls'
import { StaffCommissionReportView } from './staff-commission-report-view'

export function ManagerStaffCommissionPanel({ staffId }: { staffId: string }) {
  const [period, setPeriod] = useState<CommissionPeriodQuery>({
    period: 'today',
  })
  const reportQuery = useQuery(
    staffCommissionReportQueryOptions(staffId, period),
  )
  const saveAgreement = useSaveCommissionAgreementMutation()
  const disableAgreement = useDisableCommissionAgreementMutation()
  const agreement = reportQuery.data?.agreement

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

  return (
    <>
      <StaffDetailSection title="توافق کمیسیون" icon={Percent}>
        <form
          key={`${agreement?.percentage ?? ''}-${agreement?.active ?? false}`}
          onSubmit={save}
          className="space-y-3"
        >
          <label className="block space-y-1.5 text-xs font-bold text-foreground">
            درصد کمیسیون از مبلغ نهایی نوبت
            <div className="relative mt-1.5">
              <Input
                name="percentage"
                type="text"
                inputMode="decimal"
                required
                defaultValue={formatLocalizedNumberInput(agreement?.percentage)}
                onChange={(event) => {
                  event.currentTarget.value = formatLocalizedNumberInput(
                    normalizeLocalizedDecimalInput(event.currentTarget.value),
                  )
                }}
                className="pl-10 text-right tabular-nums"
                aria-label="درصد کمیسیون"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ٪
              </span>
            </div>
          </label>
          <p className="text-[11px] leading-5 text-muted-foreground">
            تغییر درصد فقط روی نوبت‌هایی اثر دارد که بعد از ذخیره انجام شوند.
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
