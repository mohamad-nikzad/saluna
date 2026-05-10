import { NextResponse } from 'next/server'
import { getTodayData } from '@repo/database/dashboard'
import { getTenantRequest } from '@repo/auth/tenant'
import { salonTodayYmd } from '@repo/salon-core/salon-local-time'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || salonTodayYmd()
    const staffFilter = user.role === 'staff' ? user.userId : undefined
    const today = await getTodayData(user.salonId, date, staffFilter)

    return NextResponse.json(today)
  } catch (error) {
    console.error('Today endpoint error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
