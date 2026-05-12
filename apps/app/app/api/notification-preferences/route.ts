import { NextResponse } from 'next/server'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications'
import { getTenantRequest } from '@repo/auth/tenant'

type PreferencesPatch = {
  appointmentAlertsEnabled?: unknown
  localAlertsEnabled?: unknown
  smsAlertsEnabled?: unknown
}

function readBooleanPatch(input: PreferencesPatch) {
  const patch: {
    appointmentAlertsEnabled?: boolean
    localAlertsEnabled?: boolean
    smsAlertsEnabled?: boolean
  } = {}
  for (const key of [
    'appointmentAlertsEnabled',
    'localAlertsEnabled',
    'smsAlertsEnabled',
  ] as const) {
    if (input[key] === undefined) continue
    if (typeof input[key] !== 'boolean') {
      return { ok: false as const, error: 'مقدار تنظیمات اعلان نامعتبر است' }
    }
    patch[key] = input[key]
  }
  return { ok: true as const, patch }
}

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const preferences = await getNotificationPreferences(
      user.salonId,
      user.userId
    )

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Get notification preferences error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const parsed = readBooleanPatch((await request.json()) as PreferencesPatch)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const preferences = await updateNotificationPreferences(
      user.salonId,
      user.userId,
      parsed.patch
    )

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Update notification preferences error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
