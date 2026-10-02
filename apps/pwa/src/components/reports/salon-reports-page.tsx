import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ChevronLeft } from 'lucide-react'
import { formatJalaliDate } from '@repo/salon-core/jalali'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { Field, FieldLabel } from '@repo/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'

import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { CommissionPeriodControls } from '#/components/commissions/commission-period-controls'
import { formatTomans } from '#/lib/appointment-detail-view-model'
import {
  salonMoneyReportQueryOptions,
  type CommissionPeriodQuery,
  type SalonMoneyReportQuery,
} from '#/lib/commission-queries'
import { serviceCatalogQueryOptions } from '#/lib/services-queries'
import { staffListQueryOptions } from '#/lib/staff-queries'

const PAGE_SIZE = 10
const ALL_FILTER_VALUE = '__all__'

export function SalonReportsPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<CommissionPeriodQuery>({
    period: 'month',
  })
  const [staffProfileId, setStaffProfileId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [showCommission, setShowCommission] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const staffQuery = useQuery(staffListQueryOptions())
  const catalogQuery = useQuery(serviceCatalogQueryOptions())
  const query = useMemo<SalonMoneyReportQuery>(
    () => ({
      ...period,
      staffProfileId: staffProfileId || undefined,
      categoryId: categoryId || undefined,
      serviceId: serviceId || undefined,
    }),
    [period, staffProfileId, categoryId, serviceId],
  )
  const report = useQuery(salonMoneyReportQueryOptions(query))

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [query])

  const services = catalogQuery.data?.services ?? []
  const categories = catalogQuery.data?.categories ?? []
  const visibleServices = categoryId
    ? services.filter((service) => service.categoryId === categoryId)
    : services
  const visibleAppointments = (report.data?.appointments ?? []).slice(
    0,
    visibleCount,
  )
  const summaryCards: Array<{ label: string; amount: number }> = report.data
    ? showCommission
      ? [
          {
            label: 'مبلغ نوبت‌های انجام‌شده',
            amount: report.data.summary.bookedTotal,
          },
          {
            label: 'کمیسیون پرسنل',
            amount: report.data.summary.staffCommissionTotal,
          },
          {
            label: 'مبلغ باقی‌مانده سالن',
            amount: report.data.summary.salonRetainedAmount,
          },
        ]
      : [
          {
            label: 'مبلغ نوبت‌های انجام‌شده',
            amount: report.data.summary.bookedTotal,
          },
        ]
    : []

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-line-soft bg-card px-[18px] pb-4 pt-3">
        <div className="flex items-center gap-3">
          <PageHeaderBackButton to="/settings" aria-label="بازگشت" />
          <div>
            <h1 className="text-lg font-black text-foreground">گزارش سالن</h1>
            <p className="text-[11px] text-muted-foreground">
              مبلغ نوبت‌های انجام‌شده در بازه انتخابی
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-[18px] pb-8">
        <CommissionPeriodControls value={period} onChange={setPeriod} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Field>
            <FieldLabel>فیلتر پرسنل</FieldLabel>
            <Select
              value={staffProfileId || ALL_FILTER_VALUE}
              onValueChange={(value) =>
                setStaffProfileId(value === ALL_FILTER_VALUE ? '' : value)
              }
            >
              <SelectTrigger className="w-full" aria-label="فیلتر پرسنل">
                <SelectValue placeholder="همه پرسنل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>همه پرسنل</SelectItem>
                {(staffQuery.data ?? [])
                  .filter((member) => member.role === 'staff')
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>فیلتر دسته</FieldLabel>
            <Select
              value={categoryId || ALL_FILTER_VALUE}
              onValueChange={(value) => {
                const nextCategoryId = value === ALL_FILTER_VALUE ? '' : value
                setCategoryId(nextCategoryId)
                if (
                  serviceId &&
                  nextCategoryId &&
                  !services.some(
                    (service) =>
                      service.id === serviceId &&
                      service.categoryId === nextCategoryId,
                  )
                ) {
                  setServiceId('')
                }
              }}
            >
              <SelectTrigger className="w-full" aria-label="فیلتر دسته">
                <SelectValue placeholder="همه دسته‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>همه دسته‌ها</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>فیلتر خدمت</FieldLabel>
            <Select
              value={serviceId || ALL_FILTER_VALUE}
              onValueChange={(value) =>
                setServiceId(value === ALL_FILTER_VALUE ? '' : value)
              }
            >
              <SelectTrigger className="w-full" aria-label="فیلتر خدمت">
                <SelectValue placeholder="همه خدمات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>همه خدمات</SelectItem>
                {visibleServices.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {report.data ? (
          <>
            <div
              className={
                showCommission
                  ? 'grid grid-cols-3 gap-2'
                  : 'grid grid-cols-1 gap-2'
              }
            >
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[16px] border border-line-soft bg-card p-3 shadow-sm"
                >
                  <div className="text-[10px] text-muted-foreground">
                    {card.label}
                  </div>
                  <div className="mt-1 text-sm font-black text-foreground">
                    {formatTomans(card.amount)}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowCommission((current) => !current)}
              className="text-xs font-bold text-primary touch-manipulation"
            >
              {showCommission ? 'پنهان کردن کمیسیون' : 'نمایش کمیسیون'}
            </button>

            {showCommission ? (
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
                        onClick={() => setStaffProfileId(row.staffProfileId)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-right touch-manipulation"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold">
                            {row.staffName}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {toPersianDigits(row.completedCount)} نوبت · مبلغ
                            نوبت {formatTomans(row.commissionBasisTotal)}
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
            ) : null}

            {report.data.appointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                در این بازه نوبت انجام‌شده‌ای نیست.
              </p>
            ) : (
              <section className="divide-y divide-line-soft overflow-hidden rounded-[16px] border border-line-soft bg-card">
                {visibleAppointments.map((row) => (
                  <button
                    key={row.appointmentId}
                    type="button"
                    onClick={() =>
                      navigate({
                        to: '/calendar',
                        search: {
                          date: row.date,
                          appointmentId: row.appointmentId,
                        },
                      })
                    }
                    className="block w-full p-3.5 text-right touch-manipulation"
                  >
                    <div className="flex justify-between gap-3 text-xs font-bold">
                      <span>
                        {row.clientName} · {row.serviceName}
                      </span>
                      <span className="text-primary">
                        {formatTomans(row.bookedTotal)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatJalaliDate(row.date)}</span>
                      <span>{row.staffNames.join('، ')}</span>
                    </div>
                    {showCommission
                      ? row.commissions.map((commission) => (
                          <div
                            key={`${row.appointmentId}-${commission.staffProfileId}`}
                            className="mt-1 flex justify-between text-[10px] text-muted-foreground"
                          >
                            <span>
                              {commission.staffName} · مبنا{' '}
                              {formatTomans(commission.basis)} ·{' '}
                              {toPersianDigits(commission.percentage)}٪
                            </span>
                            <span>
                              {formatTomans(commission.amount)}
                            </span>
                          </div>
                        ))
                      : null}
                  </button>
                ))}
              </section>
            )}

            {visibleCount < report.data.appointments.length ? (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="w-full rounded-[14px] border border-line-soft bg-card py-3 text-xs font-bold text-primary touch-manipulation"
              >
                نمایش بیشتر
              </button>
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
