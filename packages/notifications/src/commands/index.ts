import type { MessagingProviderId } from '../providers/types'

export type CommandResult = { status: 'ok'; message: string } | { status: 'error'; message: string }

export type ApprovalCallbackInput = {
  provider: MessagingProviderId
  externalId: string
  requestId: string
}

export type RejectionCallbackInput = {
  provider: MessagingProviderId
  externalId: string
  requestId: string
  reason?: string | null
}

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

export async function handleApprovalCallback(_input: ApprovalCallbackInput): Promise<CommandResult> {
  throw new Error('not_implemented')
}

export async function handleRejectionCallback(_input: RejectionCallbackInput): Promise<CommandResult> {
  throw new Error('not_implemented')
}

export async function handleLinkStart(_input: LinkStartInput): Promise<CommandResult> {
  throw new Error('not_implemented')
}

export async function handleUnlink(_input: UnlinkInput): Promise<CommandResult> {
  throw new Error('not_implemented')
}
