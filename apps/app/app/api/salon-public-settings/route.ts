import { NextResponse } from 'next/server'
import {
  getManagerPublicSettings,
  updateManagerPublicSettings,
} from '@repo/database/public'
import { publicSettingsSchema } from '@repo/salon-core/forms/public'
import { getTenantRequest } from '@repo/auth/tenant-next'
import { validationErrorResponse } from '../validation'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request, 'manage_settings')
    if (!tenant.ok) return tenant.response
    const result = await getManagerPublicSettings(tenant.user.salonId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Get public settings error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const tenant = await getTenantRequest(request, 'manage_settings')
    if (!tenant.ok) return tenant.response
    const parsed = publicSettingsSchema.safeParse(await request.json())
    if (!parsed.success) return validationErrorResponse(parsed.error)
    const result = await updateManagerPublicSettings(
      tenant.user.salonId,
      parsed.data,
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('Update public settings error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    )
  }
}
