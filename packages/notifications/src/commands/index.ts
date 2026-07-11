import {
  consumeLinkTokenIfValid,
  deleteAccount as deleteMessagingAccount,
  findAccountByExternalId,
  findAccountByUserAndProvider,
  linkMessagingAccountAndEnableProvider,
  type MessagingProviderId,
} from '@repo/database/messaging'

export type CommandResult =
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string; code?: string }

export type LinkStartInput = {
  provider: MessagingProviderId
  token: string
  externalId: string
  displayName?: string | null
}

export type UnlinkInput = {
  provider: MessagingProviderId
  externalId: string
}

const INVALID_LINK_TOKEN_MESSAGE =
  'این لینک نامعتبر یا منقضی شده است. لطفاً از داخل برنامه دوباره تلاش کنید.'

export async function handleLinkStart(
  input: LinkStartInput,
): Promise<CommandResult> {
  const token = await consumeLinkTokenIfValid(input.token, input.provider)
  if (!token) {
    return {
      status: 'error',
      code: 'invalid_token',
      message: INVALID_LINK_TOKEN_MESSAGE,
    }
  }

  const existing = await findAccountByExternalId(
    input.provider,
    input.externalId,
  )
  if (existing && existing.userId !== token.userId) {
    return {
      status: 'error',
      code: 'external_id_taken',
      message: 'این حساب پیام‌رسان قبلاً به کاربر دیگری متصل شده است.',
    }
  }

  await linkMessagingAccountAndEnableProvider({
    userId: token.userId,
    salonId: token.salonId,
    provider: input.provider,
    externalId: input.externalId,
    displayName: input.displayName ?? null,
  })

  return {
    status: 'ok',
    message:
      'حساب شما با موفقیت متصل شد ✅\nاز این پس اعلان‌های آراویرا را در همین گفت‌وگو دریافت خواهید کرد.',
  }
}

export async function handleUnlink(input: UnlinkInput): Promise<CommandResult> {
  const account = await findAccountByExternalId(
    input.provider,
    input.externalId,
  )
  if (!account) {
    return {
      status: 'error',
      code: 'not_linked',
      message: 'حسابی برای قطع اتصال یافت نشد.',
    }
  }
  await deleteMessagingAccount(account.id, account.userId)
  return { status: 'ok', message: 'اتصال حساب پیام‌رسان قطع شد.' }
}

export { findAccountByUserAndProvider }

export {
  handleApprovalCallback,
  handleAssignCallback,
  handleBackCallback,
  handleRejectionCallback,
  type AssignCallbackInput,
  type CallbackInput,
  type CallbackOutcome,
} from './approval'

export {
  handleHelpCommand,
  handlePendingCommand,
  handleTodayCommand,
  type BotTextInput,
  type BotTextMessage,
  type BotTextResult,
} from './bot-text'
