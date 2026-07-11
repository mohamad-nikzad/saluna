import type { AppointmentRequestStatus } from '@/lib/public-api'

export type { AppointmentRequestStatus }

export type RequestStatusHeadline = {
  title: string
  body: string
  tone: string
}

export function headlineFor(
  status: AppointmentRequestStatus,
): RequestStatusHeadline {
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
