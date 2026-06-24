import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getApiV1AdminSalonsByIdSetupCatalogOptions,
  getApiV1AdminSalonsByIdSetupStaffOptions,
  getApiV1AdminSalonsByIdSetupStaffQueryKey,
  postApiV1AdminSalonsByIdSetupStaffMutation,
} from '@repo/api-client/query'
import { STAFF_COLORS } from '@repo/salon-core/types'

import { Panel } from '#/components/admin/panel'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { MutationError } from '#/components/admin/mutation-error'

const DAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
]

type ScheduleRow = {
  dayOfWeek: number
  active: boolean
  workingStart: string
  workingEnd: string
}

const defaultSchedule = (): ScheduleRow[] =>
  DAYS.map((_, dayOfWeek) => ({
    dayOfWeek,
    active: dayOfWeek !== 6,
    workingStart: '09:00',
    workingEnd: '19:00',
  }))

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

export function SalonSetupStaff({
  salonId,
  isLiveData,
  overrideMode,
}: {
  salonId: string
  isLiveData: boolean
  overrideMode: boolean
}) {
  const queryClient = useQueryClient()
  const staffQuery = useQuery(
    getApiV1AdminSalonsByIdSetupStaffOptions({
      path: { id: salonId },
      ...(overrideMode ? { query: { override: true } } : {}),
    }),
  )
  const catalogQuery = useQuery(
    getApiV1AdminSalonsByIdSetupCatalogOptions({
      path: { id: salonId },
      ...(overrideMode ? { query: { override: true } } : {}),
    }),
  )
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [color, setColor] = useState<string>(STAFF_COLORS[0])
  const [active, setActive] = useState(true)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [schedule, setSchedule] = useState(defaultSchedule)
  const [reason, setReason] = useState('آماده‌سازی پروفایل پرسنل')
  const [liveConfirmation, setLiveConfirmation] = useState('')

  const mutation = useMutation({
    ...postApiV1AdminSalonsByIdSetupStaffMutation(),
    onSuccess: () => {
      setName('')
      setPhone('')
      setServiceIds([])
      setSchedule(defaultSchedule())
      void queryClient.invalidateQueries({
        queryKey: getApiV1AdminSalonsByIdSetupStaffQueryKey({
          path: { id: salonId },
          ...(overrideMode ? { query: { override: true } } : {}),
        }),
      })
    },
  })

  const services = (catalogQuery.data?.services ?? []).map(record)
  const profiles = (staffQuery.data?.staff ?? []).map(record)
  const updateSchedule = (day: number, patch: Partial<ScheduleRow>) =>
    setSchedule((current) =>
      current.map((row) =>
        row.dayOfWeek === day ? { ...row, ...patch } : row,
      ),
    )

  return (
    <Panel title="پروفایل‌های پرسنل">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate({
              path: { id: salonId },
              body: {
                name,
                phone,
                color,
                active,
                serviceIds,
                schedule,
                reason,
                ...(isLiveData ? { liveConfirmation } : {}),
                ...(overrideMode ? { override: true as const } : {}),
              },
            })
          }}
        >
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              این فرم فقط پروفایل عملیاتی می‌سازد. رمز عبور و تایید شماره را خود
              پرسنل در اولین ورود انجام می‌دهد.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="setup-staff-name">نام نمایشی</Label>
                <Input
                  id="setup-staff-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-staff-phone">شماره موبایل</Label>
                <Input
                  id="setup-staff-phone"
                  dir="ltr"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09121234567"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-staff-color">رنگ تقویم</Label>
                <select
                  id="setup-staff-color"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                >
                  {STAFF_COLORS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 self-end rounded-lg border px-3 py-2">
                <Checkbox
                  checked={active}
                  onCheckedChange={(value) => setActive(value === true)}
                />
                <span className="text-sm">فعال در برنامه و ظرفیت‌سنجی</span>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">توانمندی‌های خدمات</h3>
              <p className="text-xs text-muted-foreground">
                اگر هیچ موردی انتخاب نشود، همه خدمات فعال مجاز هستند.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {services
                .filter((service) => service.active !== false)
                .map((service) => {
                  const id = String(service.id ?? '')
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={serviceIds.includes(id)}
                        onCheckedChange={(checked) =>
                          setServiceIds((current) =>
                            checked === true
                              ? [...current, id]
                              : current.filter((value) => value !== id),
                          )
                        }
                      />
                      {String(service.name ?? 'خدمت')}
                    </label>
                  )
                })}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">برنامه هفتگی</h3>
            <div className="overflow-hidden rounded-xl border">
              {schedule.map((row) => (
                <div
                  key={row.dayOfWeek}
                  className="grid grid-cols-[92px_1fr_1fr] items-center gap-2 border-b px-3 py-2 last:border-0"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={row.active}
                      onCheckedChange={(value) =>
                        updateSchedule(row.dayOfWeek, {
                          active: value === true,
                        })
                      }
                    />
                    {DAYS[row.dayOfWeek]}
                  </label>
                  <Input
                    type="time"
                    aria-label={`ساعت شروع ${DAYS[row.dayOfWeek]}`}
                    value={row.workingStart}
                    disabled={!row.active}
                    onChange={(e) =>
                      updateSchedule(row.dayOfWeek, {
                        workingStart: e.target.value,
                      })
                    }
                  />
                  <Input
                    type="time"
                    aria-label={`ساعت پایان ${DAYS[row.dayOfWeek]}`}
                    value={row.workingEnd}
                    disabled={!row.active}
                    onChange={(e) =>
                      updateSchedule(row.dayOfWeek, {
                        workingEnd: e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="setup-staff-reason">دلیل تغییر</Label>
              <Input
                id="setup-staff-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            {isLiveData ? (
              <div className="space-y-2">
                <Label htmlFor="setup-staff-live">تایید داده زنده</Label>
                <Input
                  id="setup-staff-live"
                  value={liveConfirmation}
                  onChange={(e) => setLiveConfirmation(e.target.value)}
                  placeholder="LIVE"
                  required
                />
              </div>
            ) : null}
          </div>
          <MutationError error={mutation.error} />
          <Button
            type="submit"
            disabled={mutation.isPending || !name || !phone}
          >
            {mutation.isPending
              ? 'در حال ساخت…'
              : 'ساخت پروفایل بدون حساب کاربری'}
          </Button>
        </form>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">پروفایل‌های آماده‌شده</h3>
          {staffQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          ) : null}
          {profiles.length === 0 && !staffQuery.isLoading ? (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
              هنوز پروفایلی ساخته نشده است.
            </p>
          ) : null}
          {profiles.map((profile) => (
            <article
              key={String(profile.id)}
              className="rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{String(profile.name ?? '')}</p>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {String(profile.phone ?? '')}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {profile.claimed ? 'متصل‌شده' : 'در انتظار ادعا'}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {Array.isArray(profile.serviceIds) &&
                profile.serviceIds.length > 0
                  ? `${profile.serviceIds.length} خدمت انتخابی`
                  : 'همه خدمات فعال'}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  )
}
