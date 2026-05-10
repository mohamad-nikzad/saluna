import { NextResponse } from 'next/server'
import { getBusinessSettings, updateBusinessSettings } from '@repo/database/settings'
import { getTenantManagerRequest, getTenantRequest } from '@repo/auth/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const settings = await getBusinessSettings(user.salonId)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Get business settings error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const body = await request.json()
    const { workingStart, workingEnd, slotDurationMinutes } = body

    const next = await updateBusinessSettings(user.salonId, {
      ...(typeof workingStart === 'string' ? { workingStart } : {}),
      ...(typeof workingEnd === 'string' ? { workingEnd } : {}),
      ...(typeof slotDurationMinutes === 'number' ? { slotDurationMinutes } : {}),
    })

    return NextResponse.json({ settings: next })
  } catch (error) {
    console.error('Update business settings error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
