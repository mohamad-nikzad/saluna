import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import { faDigits, isolate, isTelegramInlineButtonUrl, rtl } from '../format'
import type { MessagingButton } from '../providers/types'

export type AppointmentRequestTemplateInput = {
  requestId: string
  salonName: string
  customerName: string
  customerPhone: string
  serviceName: string
  /** Gregorian date string `YYYY-MM-DD`. */
  date: string
  /** `HH:MM`. */
  startTime: string
  /** Absolute URL to the request in the manager PWA. */
  deepLinkUrl: string
}

export type AppointmentRequestTemplate = {
  title: string
  body: string
  data: Record<string, unknown>
  buttons?: MessagingButton[][]
}

export function renderAppointmentRequestPending(
  input: AppointmentRequestTemplateInput,
): AppointmentRequestTemplate {
  const date = formatJalaliFullDate(input.date)
  const title = `درخواست رزرو جدید — ${input.salonName}`
  const body = [
    rtl(input.customerName),
    rtl(`📞 ${isolate(faDigits(displayPhone(input.customerPhone)))}`),
    rtl(`✂️ ${input.serviceName}`),
    rtl(`📅 ${date} ساعت ${isolate(faDigits(input.startTime))}`),
  ].join('\n')

  const actionRow: MessagingButton[] = [
    { label: '✅ تأیید', data: `approve:${input.requestId}` },
    { label: '❌ رد', data: `reject:${input.requestId}` },
  ]
  const linkRow: MessagingButton[] | null = isTelegramInlineButtonUrl(
    input.deepLinkUrl,
  )
    ? [{ label: 'مشاهده در برنامه', url: input.deepLinkUrl }]
    : null
  const buttons: MessagingButton[][] = linkRow
    ? [actionRow, linkRow]
    : [actionRow]

  return {
    title,
    body,
    data: {
      requestId: input.requestId,
      deepLinkUrl: input.deepLinkUrl,
    },
    buttons,
  }
}
