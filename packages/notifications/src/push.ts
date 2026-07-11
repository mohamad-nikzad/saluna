import webpush from 'web-push'
import {
  deletePushSubscriptionByEndpoint,
  getPushSubscriptionsForUser,
} from '@repo/database/push'

let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  return true
}

export function isWebPushConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  )
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapidConfigured()) {
    return
  }

  const subs = await getPushSubscriptionsForUser(userId)
  if (subs.length === 0) return

  const body = JSON.stringify(payload)
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 },
        )
      } catch (err: unknown) {
        const status =
          typeof err === 'object' && err && 'statusCode' in err
            ? (err as { statusCode?: number }).statusCode
            : undefined
        if (status === 404 || status === 410) {
          await deletePushSubscriptionByEndpoint(sub.endpoint)
        } else {
          console.error('Web push send error:', err)
        }
      }
    }),
  )
}
