export type MessagingProviderId = 'telegram' | 'bale' | 'rubika' | 'whatsapp'

export type MessagingButton = {
  /** Text shown in the chat. Keep under 30 chars (Telegram limit). */
  label: string
  /** Opaque string the provider echoes back on tap. Format: `<action>:<entityId>`. */
  data: string
}

export type MessagingSendInput = {
  notificationId: string
  /** chatId / phone / waId — provider-specific. */
  externalId: string
  title: string
  body: string
  /** Optional inline keyboard. Providers without inline buttons fall back to plain text. */
  buttons?: MessagingButton[][]
  locale?: string
}

export type MessagingDeliveryResult = {
  status: 'sent' | 'failed' | 'skipped'
  providerMessageId?: string | null
  error?: string | null
}

export interface MessagingProvider {
  readonly id: MessagingProviderId
  readonly displayName: string
  readonly supportsInlineButtons: boolean
  readonly supportsInbound: boolean
  isConfigured(): boolean
  send(input: MessagingSendInput): Promise<MessagingDeliveryResult>
}
