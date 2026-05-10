import { NextResponse } from 'next/server'
import { getClientById, getClientTags, setClientTags, updateClient } from '@repo/database/clients'
import { getTenantManagerRequest } from '@repo/auth/tenant'

export async function GET(
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

    const tags = await getClientTags(id, user.salonId)
    return NextResponse.json({ client: { ...client, tags } })
  } catch (error) {
    console.error('Get client error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const body = await request.json()
    const { name, phone, notes, tags } = body

    const client = await updateClient(id, user.salonId, { name, phone, notes })

    if (!client) {
      return NextResponse.json({ error: 'مشتری یافت نشد' }, { status: 404 })
    }

    const savedTags = Array.isArray(tags)
      ? await setClientTags(id, user.salonId, tags.map(String))
      : await getClientTags(id, user.salonId)

    return NextResponse.json({ client: { ...client, tags: savedTags } })
  } catch (error: unknown) {
    console.error('Update client error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'این شماره تماس برای این سالن قبلاً ثبت شده است', code: 'duplicate-phone' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
