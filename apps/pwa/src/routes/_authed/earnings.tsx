import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Banknote } from 'lucide-react'

import { StaffSalonSwitcher } from '#/components/staff/staff-salon-switcher'
import { CommissionPeriodControls } from '#/components/commissions/commission-period-controls'
import { StaffCommissionReportView } from '#/components/commissions/staff-commission-report-view'
import {
  myCommissionReportQueryOptions,
  type CommissionPeriodQuery,
} from '#/lib/commission-queries'

export const Route = createFileRoute('/_authed/earnings')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'staff') throw redirect({ to: '/commissions' })
  },
  component: EarningsPage,
})

function EarningsPage() {
  const [period, setPeriod] = useState<CommissionPeriodQuery>({
    period: 'today',
  })
  const report = useQuery(myCommissionReportQueryOptions(period))

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-line-soft bg-card px-5 pb-4 pt-3.5">
        <StaffSalonSwitcher compact />
        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blush-soft text-primary">
            <Banknote className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">کمیسیون من</h1>
            <p className="text-[11px] text-muted-foreground">
              کمیسیون محاسبه‌شده؛ نه پرداخت یا تسویه
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 p-[18px] pb-8">
        <CommissionPeriodControls value={period} onChange={setPeriod} />
        {report.data ? (
          <StaffCommissionReportView report={report.data} />
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {report.isPending ? 'در حال دریافت گزارش…' : 'گزارش دریافت نشد'}
          </div>
        )}
      </main>
    </div>
  )
}
