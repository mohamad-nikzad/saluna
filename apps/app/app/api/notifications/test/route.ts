import { NextResponse } from 'next/server'
import { createNotificationForUser } from '@/lib/notifications'
import { getTenantRequest } from '@repo/auth/tenant'

function isNotificationTestRouteEnabled() {
  if (process.env.ENABLE_NOTIFICATION_TEST !== '1') return false

  const environment =
    process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV
  return environment !== 'production'
}

export async function POST(request: Request) {
  if (!isNotificationTestRouteEnabled()) {
    return NextResponse.json({ error: 'مسیر تست اعلان فعال نیست' }, { status: 404 })
  }

  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const now = new Date()
    const notification = await createNotificationForUser({
      salonId: user.salonId,
      userId: user.userId,
      type: 'appointment_created',
      title: 'اعلان تست',
      body: `این اعلان تست در ${now.toLocaleString('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })} ساخته شد.`,
      route: '/notifications',
      data: {
        source: 'notification_test_route',
        createdAt: now.toISOString(),
        route: '/notifications',
      },
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('Create test notification error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
