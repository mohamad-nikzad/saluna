import { NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertPushSubscription, deletePushSubscriptionForUser } from '@repo/database/push'
import { isWebPushConfigured } from '@/lib/push'
import { getTenantRequest } from '@repo/auth/tenant'

const subscribeBody = z.object({
  subscription: z.object({
    endpoint: z.string().min(1),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

const unsubscribeBody = z.object({
  endpoint: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    if (!isWebPushConfigured()) {
      return NextResponse.json({ error: 'اعلان فشاری پیکربندی نشده است' }, { status: 503 })
    }

    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const json = await request.json()
    const parsed = subscribeBody.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'داده نامعتبر' }, { status: 400 })
    }

    const { subscription } = parsed.data
    await upsertPushSubscription(user.userId, user.salonId, {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const json = await request.json()
    const parsed = unsubscribeBody.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'داده نامعتبر' }, { status: 400 })
    }

    await deletePushSubscriptionForUser(user.userId, user.salonId, parsed.data.endpoint)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
