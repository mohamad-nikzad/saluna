import { NextResponse } from 'next/server'
import { getOnboardingStatus, updateOnboardingState, type OnboardingAction } from '@repo/database/onboarding'
import { getTenantManagerRequest } from '@repo/auth/tenant'

const actions = new Set<OnboardingAction>(['confirm-profile', 'complete', 'skip', 'reopen'])

export async function GET(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const onboarding = await getOnboardingStatus(user.salonId)
    return NextResponse.json({ onboarding })
  } catch (error) {
    console.error('Get onboarding error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const body = await request.json()
    const action = String(body.action ?? '') as OnboardingAction
    if (!actions.has(action)) {
      return NextResponse.json({ error: 'درخواست نامعتبر است' }, { status: 400 })
    }

    const onboarding = await updateOnboardingState(user.salonId, action)
    return NextResponse.json({ onboarding })
  } catch (error) {
    console.error('Update onboarding error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
