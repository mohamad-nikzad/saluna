import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { resolvePublicTheme } from '@repo/salon-core/public-themes'
import {
  fetchAppointmentRequest,
  fetchPublicSalon,
  PublicApiError,
  type AppointmentRequestStatus,
  type AppointmentRequestStatusView,
} from '../../../_lib/public-api'
import { formatDuration, formatHm, formatPrice } from '../../../_lib/format'
import { CancelRequestButton } from './cancel-button'

export const dynamic = 'force-dynamic'

type Params = { slug: string; token: string }

export const metadata = {
  title: 'وضعیت درخواست رزرو | سالورا',
}

export default async function RequestStatusPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug, token } = await params

  let view: AppointmentRequestStatusView
  try {
    view = await fetchAppointmentRequest(slug, token)
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound()
    throw error
  }

  let accent = resolvePublicTheme(null).primary
  try {
    const salon = await fetchPublicSalon(slug)
    accent = resolvePublicTheme(salon.publicSettings.themeId).primary
  } catch {
    /* fall back to default accent */
  }

  return (
    <main
      dir="rtl"
      className="min-h-dvh bg-[#fdf5f8] text-[#3f2730]"
      style={{ ['--salon-accent' as never]: accent }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
        <Link
          href={`/salons/${slug}`}
          className="text-sm text-[#7a2a40] hover:underline"
        >
          {view.salon.name}
        </Link>

        <StatusHeadline status={view.status} />

        <div className="mt-6 rounded-2xl border border-[#f3d5dd] bg-white/90 p-5 shadow-[0_18px_50px_rgba(155,51,72,0.08)]">
          <dl className="space-y-3 text-sm">
            <Row label="خدمت" value={view.bookedServiceName} />
            <Row
              label="مدت زمان"
              value={formatDuration(view.bookedServiceDuration)}
            />
            <Row label="مبلغ" value={formatPrice(view.bookedServicePrice)} />
            <Row
              label="تاریخ"
              value={formatJalaliFullDate(view.requestedDate)}
            />
            <Row
              label="ساعت"
              value={`${formatHm(view.requestedStartTime)} تا ${formatHm(view.requestedEndTime)}`}
              dir="ltr"
            />
          </dl>

          {view.status === 'rejected' && view.rejectionReason ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-800">
              توضیح سالن: {view.rejectionReason}
            </p>
          ) : null}

          {view.salon.phone ? (
            <a
              href={`tel:${view.salon.phone}`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#7a2a40] hover:underline"
              dir="ltr"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {toPersianDigits(view.salon.phone)}
            </a>
          ) : null}
        </div>

        {view.status === 'pending' ? (
          <div className="mt-6">
            <CancelRequestButton slug={slug} token={token} accent={accent} />
          </div>
        ) : null}
      </div>
    </main>
  )
}

function Row({
  label,
  value,
  dir,
}: {
  label: string
  value: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#f3d5dd] pb-2 last:border-0 last:pb-0">
      <dt className="text-xs text-[#8b6b73]">{label}</dt>
      <dd className="text-sm font-bold text-[#3f2730]" dir={dir}>
        {value}
      </dd>
    </div>
  )
}

function StatusHeadline({ status }: { status: AppointmentRequestStatus }) {
  const content = headlineFor(status)
  return (
    <div className={`mt-4 rounded-2xl p-5 ${content.tone}`}>
      <p className="text-base font-extrabold leading-7 sm:text-lg">
        {content.title}
      </p>
      <p className="mt-2 text-sm leading-7 opacity-90">{content.body}</p>
    </div>
  )
}

function headlineFor(status: AppointmentRequestStatus): {
  title: string
  body: string
  tone: string
} {
  switch (status) {
    case 'pending':
      return {
        title: 'درخواست شما ثبت شد.',
        body: 'سالن درخواست شما را بررسی می‌کند و در صورت تأیید با شما تماس می‌گیرد.',
        tone: 'border border-amber-200 bg-amber-50 text-amber-900',
      }
    case 'approved':
      return {
        title: 'درخواست شما تأیید شد.',
        body: 'نوبت شما در تقویم سالن ثبت شده است. در زمان مقرر به سالن مراجعه کنید.',
        tone: 'border border-emerald-200 bg-emerald-50 text-emerald-900',
      }
    case 'rejected':
      return {
        title: 'درخواست شما تأیید نشد.',
        body: 'برای هماهنگی زمان دیگر می‌توانید مستقیماً با سالن تماس بگیرید.',
        tone: 'border border-rose-200 bg-rose-50 text-rose-900',
      }
    case 'cancelled':
      return {
        title: 'درخواست شما لغو شد.',
        body: 'این درخواست توسط شما یا سالن لغو شده است.',
        tone: 'border border-slate-200 bg-slate-50 text-slate-800',
      }
    case 'expired':
      return {
        title: 'درخواست شما در زمان مقرر بررسی نشد.',
        body: 'لطفاً برای رزرو با سالن تماس بگیرید.',
        tone: 'border border-slate-200 bg-slate-50 text-slate-800',
      }
  }
}
