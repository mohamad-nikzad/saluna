import { NextResponse } from 'next/server'
import { listNotificationsForUser } from '@/lib/notifications'
import { getTenantRequest } from '@repo/auth/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const notifications = await listNotificationsForUser({
      salonId: user.salonId,
      userId: user.userId,
      unreadOnly,
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('List notifications error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
