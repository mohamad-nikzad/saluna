import { NextResponse } from 'next/server'
import { getDashboardData } from '@repo/database/dashboard'
import { getTenantRequest } from '@repo/auth/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request, 'view_dashboard')
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const dashboard = await getDashboardData(user.salonId)
    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
