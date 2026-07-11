import {
  approveAppointmentRequest,
  getAppointmentRequestForCallback,
  rejectAppointmentRequest,
} from '@repo/database/appointment-requests'
import {
  findAccountByExternalId,
  type MessagingProviderId,
} from '@repo/database/messaging'
import { getMemberForUser } from '@repo/database/members'
import { listCapableStaffForService } from '@repo/database/staff'
import { salonCurrentHm } from '@repo/salon-core/salon-local-time'
import { buildRequestDeepLink, isTelegramInlineButtonUrl } from '../format'
import { escapeHtml } from '../providers/telegram'
import type { MessagingButton } from '../providers/types'

export type CallbackInput = {
  provider: MessagingProviderId
  externalId: string
  requestId: string
  /** Used to render an "Open in app" fallback button when auto-assign can't proceed. */
  publicAppBaseUrl?: string | null
}

export type AssignCallbackInput = CallbackInput & { staffIndex: number }

export type CallbackOutcome = {
  /** HTML-safe body the route should write back via editMessageText. Unused when `mode === 'markup'`. */
  messageHtml: string
  /** Replacement keyboard, or null to drop all buttons. */
  replacementKeyboard: MessagingButton[][] | null
  /** Short text shown as a popup toast over the tapped button (<=200 chars). */
  toast: string
  /**
   * `'text'` (default) edits both the message body and the keyboard.
   * `'markup'` swaps only the reply markup, leaving the body untouched.
   */
  mode?: 'text' | 'markup'
}

const MANAGER_ROLES = new Set(['owner', 'admin'])

type ResolvedCaller = {
  userId: string
  displayName: string
}

type ResolveOk = {
  ok: true
  caller: ResolvedCaller
  salonId: string
  serviceId: string
}
type ResolveErr = { ok: false; outcome: CallbackOutcome }

async function resolveCaller(
  input: CallbackInput,
): Promise<ResolveOk | ResolveErr> {
  const account = await findAccountByExternalId(
    input.provider,
    input.externalId,
  )
  if (!account || !account.enabled) {
    return {
      ok: false,
      outcome: {
        messageHtml: '⚠️ این حساب پیام‌رسان به آراویرا متصل نیست.',
        replacementKeyboard: null,
        toast: 'حساب متصل نیست',
      },
    }
  }

  const request = await getAppointmentRequestForCallback(input.requestId)
  if (!request) {
    return {
      ok: false,
      outcome: {
        messageHtml: '⚠️ این درخواست یافت نشد.',
        replacementKeyboard: null,
        toast: 'درخواست یافت نشد',
      },
    }
  }

  const member = await getMemberForUser(account.userId)
  if (
    !member ||
    member.organizationId !== request.salonId ||
    !MANAGER_ROLES.has(member.role)
  ) {
    return {
      ok: false,
      outcome: {
        messageHtml: '⚠️ شما دیگر مدیر این سالن نیستید.',
        replacementKeyboard: null,
        toast: 'دسترسی ندارید',
      },
    }
  }

  if (request.status !== 'pending') {
    return {
      ok: false,
      outcome: {
        messageHtml: '⚠️ این درخواست قبلاً رسیدگی شده است.',
        replacementKeyboard: null,
        toast: 'قبلاً رسیدگی شده',
      },
    }
  }

  return {
    ok: true,
    caller: { userId: account.userId, displayName: member.name },
    salonId: request.salonId,
    serviceId: request.serviceId,
  }
}

/** Single "open in app" URL button, or null when no base URL is configured. */
function openInAppButton(
  requestId: string,
  publicAppBaseUrl: string | null | undefined,
): MessagingButton | null {
  const base = publicAppBaseUrl?.trim()
  if (!base) return null
  const url = buildRequestDeepLink(base, requestId)
  if (!isTelegramInlineButtonUrl(url)) return null
  return { label: 'مشاهده در برنامه', url }
}

function openInAppKeyboard(
  requestId: string,
  publicAppBaseUrl: string | null | undefined,
): MessagingButton[][] | null {
  const button = openInAppButton(requestId, publicAppBaseUrl)
  return button ? [[button]] : null
}

/** The original live-notification keyboard: `[[approve, reject], [open-in-app?]]`. */
function originalRequestKeyboard(
  requestId: string,
  publicAppBaseUrl: string | null | undefined,
): MessagingButton[][] {
  const rows: MessagingButton[][] = [
    [
      { label: '✅ تأیید', data: `approve:${requestId}` },
      { label: '❌ رد', data: `reject:${requestId}` },
    ],
  ]
  const openButton = openInAppButton(requestId, publicAppBaseUrl)
  if (openButton) rows.push([openButton])
  return rows
}

async function approveWithStaff(
  input: CallbackInput,
  resolved: ResolveOk,
  staffId: string,
): Promise<CallbackOutcome> {
  const result = await approveAppointmentRequest({
    id: input.requestId,
    salonId: resolved.salonId,
    staffId,
    reviewedByUserId: resolved.caller.userId,
  })
  if (!result.ok) {
    if (result.status === 409) {
      return {
        messageHtml:
          '⚠️ این درخواست دیگر قابل تأیید نیست (احتمالاً قبلاً رسیدگی شده یا تداخل دارد).',
        replacementKeyboard: openInAppKeyboard(
          input.requestId,
          input.publicAppBaseUrl,
        ),
        toast: 'تأیید ممکن نیست',
      }
    }
    return {
      messageHtml: `⚠️ ${escapeHtml(result.error)}`,
      replacementKeyboard: openInAppKeyboard(
        input.requestId,
        input.publicAppBaseUrl,
      ),
      toast: 'خطا',
    }
  }

  const hm = salonCurrentHm()
  return {
    messageHtml: `✅ تأیید شد توسط ${escapeHtml(resolved.caller.displayName)} در ${hm}`,
    replacementKeyboard: null,
    toast: 'تأیید شد',
  }
}

export async function handleApprovalCallback(
  input: CallbackInput,
): Promise<CallbackOutcome> {
  const resolved = await resolveCaller(input)
  if (!resolved.ok) return resolved.outcome

  const staff = await listCapableStaffForService(
    resolved.salonId,
    resolved.serviceId,
  )
  if (staff.length === 0) {
    return {
      messageHtml: '👉 برای انتخاب پرسنل، در برنامه باز کنید.',
      replacementKeyboard: openInAppKeyboard(
        input.requestId,
        input.publicAppBaseUrl,
      ),
      toast: 'انتخاب پرسنل در برنامه',
    }
  }

  if (staff.length === 1) {
    return approveWithStaff(input, resolved, staff[0]!.id)
  }

  // Multiple capable staff: expand keyboard to a per-staff picker (markup-only).
  const staffRows: MessagingButton[][] = staff.map((s, idx) => [
    { label: s.name, data: `asg:${input.requestId}:${idx}` },
  ])
  const backRow: MessagingButton[] = [
    { label: '↩️ بازگشت', data: `back:${input.requestId}` },
  ]
  const openButton = openInAppButton(input.requestId, input.publicAppBaseUrl)
  if (openButton) backRow.push(openButton)

  return {
    messageHtml: '',
    replacementKeyboard: [...staffRows, backRow],
    toast: 'انتخاب پرسنل',
    mode: 'markup',
  }
}

export async function handleAssignCallback(
  input: AssignCallbackInput,
): Promise<CallbackOutcome> {
  const resolved = await resolveCaller(input)
  if (!resolved.ok) return resolved.outcome

  const staff = await listCapableStaffForService(
    resolved.salonId,
    resolved.serviceId,
  )
  const picked = staff[input.staffIndex]
  if (!picked) {
    return {
      messageHtml: '👉 برای انتخاب پرسنل، در برنامه باز کنید.',
      replacementKeyboard: openInAppKeyboard(
        input.requestId,
        input.publicAppBaseUrl,
      ),
      toast: 'انتخاب پرسنل نامعتبر است',
    }
  }

  return approveWithStaff(input, resolved, picked.id)
}

export async function handleBackCallback(
  input: CallbackInput,
): Promise<CallbackOutcome> {
  const resolved = await resolveCaller(input)
  if (!resolved.ok) return resolved.outcome

  return {
    messageHtml: '',
    replacementKeyboard: originalRequestKeyboard(
      input.requestId,
      input.publicAppBaseUrl,
    ),
    toast: 'بازگشت',
    mode: 'markup',
  }
}

export async function handleRejectionCallback(
  input: CallbackInput,
): Promise<CallbackOutcome> {
  const resolved = await resolveCaller(input)
  if (!resolved.ok) return resolved.outcome

  const result = await rejectAppointmentRequest({
    id: input.requestId,
    salonId: resolved.salonId,
    reviewedByUserId: resolved.caller.userId,
    reason: 'rejected via Telegram',
  })
  if (!result.ok) {
    return {
      messageHtml: '⚠️ این درخواست دیگر قابل رد نیست.',
      replacementKeyboard: null,
      toast: 'رد ممکن نیست',
    }
  }

  const hm = salonCurrentHm()
  return {
    messageHtml: `❌ رد شد توسط ${escapeHtml(resolved.caller.displayName)} در ${hm}`,
    replacementKeyboard: null,
    toast: 'رد شد',
  }
}
