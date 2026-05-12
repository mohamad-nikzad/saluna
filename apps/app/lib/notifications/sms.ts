import { getUserById } from '@repo/database/auth-users'
import {
  getNotificationPreferences,
  type AppNotification,
  type NotificationDeliveryStatus,
} from '@repo/database/notifications'

export type SmsDeliveryResult = {
  status: Extract<NotificationDeliveryStatus, 'sent' | 'failed' | 'skipped'>
  provider?: string | null
  providerMessageId?: string | null
  error?: string | null
}

type SmsProviderConfig = {
  provider: string
  apiUrl: string
  apiKey: string
  sender: string
}

function isSmsEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function readSmsProviderConfig(): SmsProviderConfig | null {
  if (!isSmsEnabled(process.env.SMS_ENABLED)) return null

  const provider = process.env.SMS_PROVIDER?.trim()
  const apiUrl = process.env.SMS_API_URL?.trim()
  const apiKey = process.env.SMS_API_KEY?.trim()
  const sender = process.env.SMS_SENDER?.trim()

  if (!provider || !apiUrl || !apiKey || !sender) return null
  return { provider, apiUrl, apiKey, sender }
}

function extractProviderMessageId(responseBody: unknown): string | null {
  if (!responseBody || typeof responseBody !== 'object') return null
  const body = responseBody as Record<string, unknown>
  const value = body.messageId ?? body.id ?? body.providerMessageId
  return typeof value === 'string' ? value : null
}

export async function sendSmsNotification(
  notification: AppNotification
): Promise<SmsDeliveryResult> {
  const config = readSmsProviderConfig()
  if (!config) {
    return {
      status: 'skipped',
      provider: process.env.SMS_PROVIDER?.trim() || null,
      error: 'sms_provider_not_configured',
    }
  }

  const preferences = await getNotificationPreferences(
    notification.salonId,
    notification.userId
  )
  if (!preferences.smsAlertsEnabled) {
    return {
      status: 'skipped',
      provider: config.provider,
      error: 'sms_alerts_disabled',
    }
  }

  const recipient = await getUserById(notification.userId)
  if (!recipient || recipient.salonId !== notification.salonId) {
    return {
      status: 'skipped',
      provider: config.provider,
      error: 'sms_recipient_not_found',
    }
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipient.phone,
        from: config.sender,
        title: notification.title,
        body: notification.body,
        route: notification.route,
        data: notification.data,
        notificationId: notification.id,
      }),
    })
    const responseText = await response.text()
    const responseBody = responseText ? JSON.parse(responseText) : null

    if (!response.ok) {
      return {
        status: 'failed',
        provider: config.provider,
        error: responseText || `sms_provider_http_${response.status}`,
      }
    }

    return {
      status: 'sent',
      provider: config.provider,
      providerMessageId: extractProviderMessageId(responseBody),
    }
  } catch (error) {
    return {
      status: 'failed',
      provider: config.provider,
      error: error instanceof Error ? error.message : 'sms_provider_error',
    }
  }
}
