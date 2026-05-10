import { NextResponse } from 'next/server'
import { createClientFollowUp, getClientById } from '@repo/database/clients'
import type { FollowUpReason } from '@repo/salon-core/types'
import { getTenantManagerRequest } from '@repo/auth/tenant'

const allowedReasons = new Set<FollowUpReason>([
  'inactive',
  'no-show',
  'new-client',
  'vip',
  'manual',
])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const client = await getClientById(id, user.salonId)
    if (!client) {
      return NextResponse.json({ error: 'مشتری یافت نشد' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = allowedReasons.has(body.reason) ? body.reason : 'manual'
    const dueDate = typeof body.dueDate === 'string' ? body.dueDate : undefined
    const followUp = await createClientFollowUp(user.salonId, id, reason, dueDate)

    return NextResponse.json({ followUp })
  } catch (error) {
    console.error('Create client follow-up error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
