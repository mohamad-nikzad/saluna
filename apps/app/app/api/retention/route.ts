import { NextResponse } from 'next/server'
import { getRetentionQueue } from '@repo/database/retention'
import { getTenantManagerRequest } from '@repo/auth/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const items = await getRetentionQueue(user.salonId)
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Retention queue error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
