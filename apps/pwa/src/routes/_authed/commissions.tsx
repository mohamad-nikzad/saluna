import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ChevronLeft } from 'lucide-react'
import { formatJalaliDate } from '@repo/salon-core/jalali'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { CommissionPeriodControls } from '#/components/commissions/commission-period-controls'
import { formatTomans } from '#/lib/appointment-detail-view-model'
import {
  salonCommissionReportQueryOptions,
  type CommissionPeriodQuery,
} from '#/lib/commission-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'

export const Route = createFileRoute('/_authed/commissions')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') throw redirect({ to: '/earnings' })
  },
  component: SalonCommissionsPage,
})

function SalonCommissionsPage() {
  const [period, setPeriod] = useState<CommissionPeriodQuery>({
    period: 'today',
  })
  const staffQuery = useQuery(staffListQueryOptions())
  const report = useQuery(salonCommissionReportQueryOptions(period))

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-line-soft bg-card px-[18px] pb-4 pt-3">
        <div className="flex items-center gap-3">
          <PageHeaderBackButton to="/settings" aria-label="بازگشت" />
          <div>
            <h1 className="text-lg font-black text-foreground">
              گزارش کمیسیون سالن
            </h1>
            <p className="text-[11px] text-muted-foreground">
              درآمد ناخالص نوبت، کمیسیون پرسنل و مبلغ باقی‌مانده سالن
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-[18px] pb-8">
        <CommissionPeriodControls value={period} onChange={setPeriod} />
        <label className="block space-y-1 text-xs font-bold text-foreground">
          فیلتر پرسنل
          <select
            value={period.staffProfileId ?? ''}
            onChange={(event) =>
              setPeriod((current) => ({
                ...current,
                staffProfileId: event.target.value || undefined,
              }))
            }
            className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">همه پرسنل</option>
            {(staffQuery.data ?? [])
              .filter((member) => member.role === 'staff')
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
        </label>

        {report.data ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                [
                  'درآمد ناخالص نوبت',
                  report.data.summary.grossAppointmentRevenue,
                ],
                ['کمیسیون پرسنل', report.data.summary.staffCommissionTotal],
                [
                  'مبلغ باقی‌مانده سالن',
                  report.data.summary.salonRetainedAmount,
                ],
              ].map(([label, amount]) => (
                <div
                  key={label}
                  className="rounded-[16px] border border-line-soft bg-card p-3 shadow-sm"
                >
                  <div className="text-[10px] text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-1 text-sm font-black text-foreground">
                    {formatTomans(amount as number)}
                  </div>
                </div>
              ))}
            </div>

            <section className="overflow-hidden rounded-[16px] border border-line-soft bg-card">
              <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
                <Banknote className="size-4 text-primary" />
                <h2 className="text-sm font-black">خلاصه پرسنل</h2>
              </div>
              {report.data.staff.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  در این بازه کمیسیونی ثبت نشده است.
                </p>
              ) : (
                <div className="divide-y divide-line-soft">
                  {report.data.staff.map((row) => (
                    <button
                      key={row.staffProfileId}
                      type="button"
                      onClick={() =>
                        setPeriod((current) => ({
                          ...current,
                          staffProfileId: row.staffProfileId,
                        }))
                      }
                      className="flex w-full items-center gap-3 px-4 py-3 text-right touch-manipulation"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold">{row.staffName}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {toPersianDigits(row.completedCount)} نوبت · درآمد
                          ناخالص {formatTomans(row.grossAppointmentRevenue)}
                        </div>
                      </div>
                      <div className="text-xs font-black text-primary">
                        {formatTomans(row.staffCommissionTotal)}
                      </div>
                      <ChevronLeft className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {report.data.rows.length > 0 ? (
              <section className="divide-y divide-line-soft overflow-hidden rounded-[16px] border border-line-soft bg-card">
                {report.data.rows.map((row) => (
                  <div key={row.appointmentId} className="p-3.5">
                    <div className="flex justify-between gap-3 text-xs font-bold">
                      <span>
                        {row.clientName} · {row.serviceName}
                      </span>
                      <span className="text-primary">
                        {formatTomans(row.amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatJalaliDate(row.date)}</span>
                      <span>
                        مبنا {formatTomans(row.basis)} ·{' '}
                        {toPersianDigits(row.percentage)}٪
                      </span>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {report.isPending ? 'در حال دریافت گزارش…' : 'گزارش دریافت نشد'}
          </div>
        )}
      </main>
    </div>
  )
}
