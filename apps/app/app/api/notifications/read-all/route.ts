import { NextResponse } from 'next/server'
import { markAllNotificationsRead } from '@/lib/notifications'
import { getTenantRequest } from '@repo/auth/tenant'

export async function POST(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const updatedCount = await markAllNotificationsRead(
      user.salonId,
      user.userId
    )

    return NextResponse.json({ success: true, updatedCount })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
