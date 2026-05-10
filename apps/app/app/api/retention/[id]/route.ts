import { NextResponse } from 'next/server'
import { updateClientFollowUpStatus } from '@repo/database/clients'
import type { FollowUpStatus } from '@repo/salon-core/types'
import { getTenantManagerRequest } from '@repo/auth/tenant'

const allowedStatuses = new Set<FollowUpStatus>(['open', 'reviewed', 'dismissed'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const body = await request.json()
    if (!allowedStatuses.has(body.status)) {
      return NextResponse.json({ error: 'وضعیت نامعتبر است' }, { status: 400 })
    }

    const { id } = await params
    const followUp = await updateClientFollowUpStatus(user.salonId, id, body.status)
    if (!followUp) {
      return NextResponse.json({ error: 'پیگیری یافت نشد' }, { status: 404 })
    }

    return NextResponse.json({ followUp })
  } catch (error) {
    console.error('Update retention item error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
