import { NextResponse } from 'next/server'
import { markNotificationRead } from '@/lib/notifications'
import { getTenantRequest } from '@repo/auth/tenant'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant
    const { id } = await context.params

    const notification = await markNotificationRead(
      user.salonId,
      user.userId,
      id
    )
    if (!notification) {
      return NextResponse.json({ error: 'اعلان پیدا نشد' }, { status: 404 })
    }

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('Mark notification read error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
