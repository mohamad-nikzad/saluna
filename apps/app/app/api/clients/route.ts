import { NextResponse } from 'next/server'
import { getAllClients, createClient, setClientTags, isClientProvidedEntityId } from '@repo/database/clients'
import { getTenantManagerRequest } from '@repo/auth/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const clients = await getAllClients(user.salonId)
    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Get clients error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const body = await request.json()
    const { name, phone, notes, tags, id: requestedId } = body

    if (!name || !phone) {
      return NextResponse.json({ error: 'نام و شماره تماس الزامی است' }, { status: 400 })
    }

    const client = await createClient({
      name,
      phone,
      notes,
      salonId: user.salonId,
      ...(isClientProvidedEntityId(requestedId) ? { id: requestedId } : {}),
    })
    const savedTags = Array.isArray(tags)
      ? await setClientTags(client.id, user.salonId, tags.map(String))
      : []
    return NextResponse.json({ client: { ...client, tags: savedTags } })
  } catch (error: unknown) {
    console.error('Create client error:', error)
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
