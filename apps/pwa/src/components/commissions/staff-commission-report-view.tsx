import type { StaffCommissionReport } from '@repo/api-client/types'
import { Badge } from '@repo/ui/badge'
import { formatJalaliDate } from '@repo/salon-core/jalali'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { formatTomans } from '#/lib/appointment-detail-view-model'

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-line-soft bg-paper p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-black text-foreground">{value}</div>
    </div>
  )
}

export function StaffCommissionReportView({
  report,
}: {
  report: StaffCommissionReport
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line-soft bg-paper px-3.5 py-3">
        <div>
          <div className="text-xs font-bold text-foreground">توافق کمیسیون</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            درصد یکسان برای همه خدمات
          </div>
        </div>
        {report.agreement ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-primary">
              {toPersianDigits(report.agreement.percentage)}٪
            </span>
            <Badge variant={report.agreement.active ? 'default' : 'secondary'}>
              {report.agreement.active ? 'فعال' : 'غیرفعال'}
            </Badge>
          </div>
        ) : (
          <Badge variant="outline">تنظیم نشده</Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Summary
          label="نوبت انجام‌شده"
          value={toPersianDigits(report.summary.completedCount)}
        />
        <Summary
          label="درآمد ناخالص نوبت"
          value={formatTomans(report.summary.grossAppointmentRevenue)}
        />
        <Summary
          label="کمیسیون پرسنل"
          value={formatTomans(report.summary.staffCommissionTotal)}
        />
      </div>

      {report.rows.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line p-6 text-center text-xs text-muted-foreground">
          در این بازه کمیسیونی ثبت نشده است.
        </div>
      ) : (
        <div className="divide-y divide-line-soft overflow-hidden rounded-[14px] border border-line-soft bg-paper">
          {report.rows.map((row) => (
            <div key={row.appointmentId} className="space-y-2 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground">
                    {row.clientName} · {row.serviceName}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatJalaliDate(row.date)}
                  </div>
                </div>
                <div className="shrink-0 text-left text-xs font-black text-primary">
                  {formatTomans(row.amount)}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>مبنای محاسبه: {formatTomans(row.basis)}</span>
                <span>درصد اعمال‌شده: {toPersianDigits(row.percentage)}٪</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
