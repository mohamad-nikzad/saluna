import { listAppointmentRequests } from '@repo/database/appointment-requests'
import { getAppointmentsWithDetailsByDateRange } from '@repo/database/appointments'
import { getMemberForUser } from '@repo/database/members'
import {
  findAccountByExternalId,
  type MessagingProviderId,
} from '@repo/database/messaging'
import { formatJalaliFullDate } from '@repo/salon-core/jalali'
import { displayPhone } from '@repo/salon-core/phone'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'

import {
  buildRequestDeepLink,
  faDigits,
  isolate,
  isTelegramInlineButtonUrl,
  rtl,
} from '../format'
import { escapeHtml } from '../providers/telegram'
import type { MessagingButton } from '../providers/types'

const MANAGER_ROLES = new Set(['owner', 'admin'])
const MAX_LIST_ITEMS = 10

export type BotTextInput = {
  provider: MessagingProviderId
  externalId: string
  /** Absolute base URL of the manager PWA, used for "open in app" buttons. */
  publicAppBaseUrl?: string | null
}

export type BotTextMessage = {
  messageHtml: string
  buttons?: MessagingButton[][]
}

export type BotTextResult = {
  /** Messages to send back-to-back. First is the header; subsequent are list items. */
  messages: BotTextMessage[]
}

type ResolvedCaller = {
  userId: string
  salonId: string
  role: 'manager' | 'staff'
  name: string
}

async function resolveCaller(
  input: BotTextInput,
): Promise<ResolvedCaller | null> {
  const account = await findAccountByExternalId(
    input.provider,
    input.externalId,
  )
  if (!account || !account.enabled) return null
  const member = await getMemberForUser(account.userId)
  if (!member) return null
  return {
    userId: account.userId,
    salonId: member.organizationId,
    role: MANAGER_ROLES.has(member.role) ? 'manager' : 'staff',
    name: member.name,
  }
}

const NOT_LINKED: BotTextResult = {
  messages: [
    {
      messageHtml:
        '⚠️ این حساب پیام‌رسان به آراویرا متصل نیست. لطفاً از داخل برنامه روی «اتصال تلگرام» بزنید.',
    },
  ],
}

export async function handlePendingCommand(
  input: BotTextInput,
): Promise<BotTextResult> {
  const caller = await resolveCaller(input)
  if (!caller) return NOT_LINKED
  if (caller.role !== 'manager') {
    return {
      messages: [
        { messageHtml: 'این دستور فقط برای مدیران سالن در دسترس است.' },
      ],
    }
  }

  const requests = await listAppointmentRequests(caller.salonId, {
    status: 'pending',
  })
  if (requests.length === 0) {
    return { messages: [{ messageHtml: '✅ درخواست در انتظار ندارید.' }] }
  }

  const shown = requests.slice(0, MAX_LIST_ITEMS)
  const header =
    requests.length > shown.length
      ? `📋 ${faDigits(shown.length)} درخواست از مجموع ${faDigits(requests.length)} درخواست در انتظار:`
      : `📋 ${faDigits(requests.length)} درخواست در انتظار:`

  const base = input.publicAppBaseUrl?.trim()
  const messages: BotTextMessage[] = [{ messageHtml: header }]
  for (const r of shown) {
    const date = formatJalaliFullDate(r.requestedDate)
    const name = r.existingClient?.name ?? r.customerName
    const body = [
      rtl(escapeHtml(name)),
      rtl(`✂️ ${escapeHtml(r.bookedServiceName)}`),
      rtl(`📞 ${isolate(faDigits(displayPhone(r.customerPhone)))}`),
      rtl(
        `📅 ${escapeHtml(date)} ساعت ${isolate(faDigits(r.requestedStartTime))}`,
      ),
    ].join('\n\n')
    const buttons: MessagingButton[][] = [
      [
        { label: '✅ تأیید', data: `approve:${r.id}` },
        { label: '❌ رد', data: `reject:${r.id}` },
      ],
    ]
    if (base) {
      const url = buildRequestDeepLink(base, r.id)
      if (isTelegramInlineButtonUrl(url)) {
        buttons.push([{ label: 'مشاهده در برنامه', url }])
      }
    }
    messages.push({ messageHtml: body, buttons })
  }
  return { messages }
}

export async function handleTodayCommand(
  input: BotTextInput,
): Promise<BotTextResult> {
  const caller = await resolveCaller(input)
  if (!caller) return NOT_LINKED

  const today = salonTodayYmd()
  const appointments = await getAppointmentsWithDetailsByDateRange(
    caller.salonId,
    today,
    today,
    caller.role === 'staff' ? caller.userId : undefined,
  )

  const dateLabel = formatJalaliFullDate(today)
  if (appointments.length === 0) {
    return {
      messages: [
        {
          messageHtml: `📅 <b>${escapeHtml(dateLabel)}</b>\nقراری برای امروز ثبت نشده است.`,
        },
      ],
    }
  }

  const shown = appointments.slice(0, MAX_LIST_ITEMS)
  const lines: string[] = [`📅 <b>${escapeHtml(dateLabel)}</b>`]
  for (const a of shown) {
    const time = `${a.startTime}–${a.endTime}`
    const who =
      caller.role === 'manager'
        ? `${a.client.name} • ${a.staff.name}`
        : a.client.name
    lines.push(
      `• ${escapeHtml(time)} — ${escapeHtml(who)} — ${escapeHtml(a.service.name)}`,
    )
  }
  if (appointments.length > shown.length) {
    lines.push(`… و ${appointments.length - shown.length} مورد دیگر`)
  }
  return { messages: [{ messageHtml: lines.join('\n') }] }
}

const HELP_TEXT = [
  '<b>راهنمای ربات آراویرا</b>',
  '',
  '/pending — درخواست‌های در انتظار',
  '/today — قرارهای امروز',
  '/unlink — قطع اتصال حساب',
  '/help — همین راهنما',
  '',
  'برای رزروهای جدید، روی دکمه‌های <b>تأیید</b> یا <b>رد</b> در پیام‌های این ربات بزنید.',
].join('\n')

export function handleHelpCommand(): BotTextResult {
  return { messages: [{ messageHtml: HELP_TEXT }] }
}
