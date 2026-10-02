import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { APPOINTMENT_STATUS } from '@repo/salon-core/types'
import { formatJalaliDate } from '@repo/salon-core/jalali'
import { toLatinDigits, toPersianDigits } from '@repo/salon-core/persian-digits'
import { reportingPeriodRange } from '@repo/salon-core/reporting-period'
import { normalizePersianSearch } from '@repo/salon-core/iran-locations'
import { Input } from '@repo/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/select'

import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { CommissionPeriodControls } from '#/components/commissions/commission-period-controls'
import type { CommissionPeriodQuery } from '#/lib/commission-queries'
import { appointmentsRangeQueryOptions } from '#/lib/appointments-queries'

const PAGE_SIZE = 25

export function AppointmentListPage() {
  const [period, setPeriod] = useState<CommissionPeriodQuery>({
    period: 'month',
  })
  const [status, setStatus] = useState('')
  const [staffId, setStaffId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  let range: ReturnType<typeof reportingPeriodRange> | undefined
  try {
    range = reportingPeriodRange({
      ...period,
      period: period.period ?? 'month',
    })
  } catch {
    // The custom picker permits an unfinished or reversed range while editing.
  }
  const appointments = useQuery({
    ...appointmentsRangeQueryOptions(
      range?.startDate ?? '',
      range?.endDate ?? '',
    ),
    enabled: range !== undefined,
  })
  const rows = appointments.data ?? []
  // Derive choices from history so inactive staff and services remain searchable.
  const staffChoices = new Map(
    rows.flatMap((row) =>
      row.staffAssignments.map(
        (assignment) =>
          [
            assignment.staffId,
            assignment.staff?.name ?? 'پرسنل نامشخص',
          ] as const,
      ),
    ),
  )
  const serviceChoices = new Map(
    rows.map((row) => [row.serviceId, row.bookedServiceName]),
  )
  const needle = normalizePersianSearch(toLatinDigits(search))
  const filtered = rows
    .filter(
      (row) =>
        (!status || row.status === status) &&
        (!staffId ||
          row.staffAssignments.some(
            (assignment) => assignment.staffId === staffId,
          )) &&
        (!serviceId || row.serviceId === serviceId) &&
        (!needle ||
          normalizePersianSearch(
            toLatinDigits(`${row.client.name} ${row.client.phone ?? ''}`),
          ).includes(needle)),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.startTime.localeCompare(a.startTime) ||
        a.id.localeCompare(b.id),
    )
  const lastPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)
  const currentPage = Math.min(page, lastPage)

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-line-soft bg-card px-[18px] pb-4 pt-3">
        <div className="flex items-center gap-3">
          <PageHeaderBackButton to="/settings" aria-label="بازگشت" />
          <div>
            <h1 className="text-lg font-black">نوبت‌ها</h1>
            <p className="text-[11px] text-muted-foreground">
              همه وضعیت‌ها در بازه انتخابی، از جدید به قدیم
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 p-[18px] pb-8">
        <CommissionPeriodControls
          value={period}
          onChange={(value) => {
            setPeriod(value)
            setPage(0)
            setStaffId('')
            setServiceId('')
          }}
        />
        <label className="block space-y-1 text-xs">
          <span>جستجوی مشتری</span>
          <Input
            value={search}
            placeholder="نام یا شماره موبایل"
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <AppointmentFilter
            label="وضعیت"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(0)
            }}
            options={Object.entries(APPOINTMENT_STATUS).map(([value, item]) => [
              value,
              item.label,
            ])}
          />
          <AppointmentFilter
            label="پرسنل"
            value={staffId}
            onChange={(value) => {
              setStaffId(value)
              setPage(0)
            }}
            options={[...staffChoices]}
          />
          <AppointmentFilter
            label="خدمت"
            value={serviceId}
            onChange={(value) => {
              setServiceId(value)
              setPage(0)
            }}
            options={[...serviceChoices]}
          />
        </div>
        {!range ? (
          <p role="alert">تاریخ پایان باید برابر یا بعد از تاریخ شروع باشد.</p>
        ) : appointments.isError ? (
          <div role="alert" className="space-y-2 text-center">
            <p>دریافت نوبت‌ها انجام نشد.</p>
            <button
              type="button"
              className="text-primary"
              onClick={() => void appointments.refetch()}
            >
              تلاش دوباره
            </button>
          </div>
        ) : appointments.isPending ? (
          <p role="status" className="py-8 text-center">
            در حال دریافت نوبت‌ها…
          </p>
        ) : (
          <>
            <p role="status" className="text-xs text-muted-foreground">
              {toPersianDigits(filtered.length)} نوبت
            </p>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                نوبتی با این فیلترها پیدا نشد.
              </p>
            ) : (
              <section
                aria-label="فهرست نوبت‌ها"
                className="divide-y divide-line-soft overflow-hidden rounded-[16px] border border-line-soft bg-card"
              >
                {filtered
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((row) => (
                    <Link
                      key={row.id}
                      to="/calendar"
                      search={{ date: row.date, appointmentId: row.id }}
                      className="block space-y-2 p-3.5 text-right touch-manipulation"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs font-bold">
                        <span>
                          {row.client.name} · {row.bookedServiceName}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${APPOINTMENT_STATUS[row.status].color}`}
                        >
                          {APPOINTMENT_STATUS[row.status].label}
                        </span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {formatJalaliDate(row.date)} ·{' '}
                          {toPersianDigits(row.startTime)} تا{' '}
                          {toPersianDigits(row.endTime)}
                        </span>
                        <span>
                          {row.staffAssignments
                            .map(
                              (assignment) =>
                                assignment.staff?.name ?? 'پرسنل نامشخص',
                            )
                            .join('، ')}
                        </span>
                      </div>
                    </Link>
                  ))}
              </section>
            )}
            {lastPage > 0 ? (
              <nav
                aria-label="صفحه‌های نوبت‌ها"
                className="flex items-center justify-between text-xs"
              >
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                  className="rounded-xl border p-3 disabled:opacity-40"
                >
                  صفحه قبل
                </button>
                <span>
                  {toPersianDigits(currentPage + 1)} از{' '}
                  {toPersianDigits(lastPage + 1)}
                </span>
                <button
                  type="button"
                  disabled={currentPage === lastPage}
                  onClick={() => setPage(currentPage + 1)}
                  className="rounded-xl border p-3 disabled:opacity-40"
                >
                  صفحه بعد
                </button>
              </nav>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

function AppointmentFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <div className="space-y-1 text-xs">
      <span>{label}</span>
      <Select
        value={value || '__all__'}
        onValueChange={(next) => onChange(next === '__all__' ? '' : next)}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">همه</SelectItem>
          {options.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
