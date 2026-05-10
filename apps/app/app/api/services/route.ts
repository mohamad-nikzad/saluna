import { NextResponse } from 'next/server'
import { getAllServices, createService } from '@repo/database/services'
import { isClientProvidedEntityId } from '@repo/database/clients'
import type { Service } from '@repo/salon-core/types'
import { getTenantManagerRequest, getTenantRequest, isManagerRole } from '@repo/auth/tenant'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === '1' && isManagerRole(user.role)
    const list = await getAllServices(user.salonId, all)
    return NextResponse.json({ services: list })
  } catch (error) {
    console.error('Get services error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const body = await request.json()
    const { name, category, duration, price, color, active, id } = body

    if (!name || !category || duration == null || price == null || !color) {
      return NextResponse.json({ error: 'فیلدهای الزامی ناقص است' }, { status: 400 })
    }

    if (id !== undefined && id !== null && !isClientProvidedEntityId(String(id))) {
      return NextResponse.json({ error: 'شناسه خدمت نامعتبر است' }, { status: 400 })
    }

    const service = await createService({
      name,
      category: category as Service['category'],
      duration: Number(duration),
      price: Number(price),
      color,
      active: active !== false,
      salonId: user.salonId,
      ...(isClientProvidedEntityId(String(id)) ? { id: String(id) } : {}),
    })

    return NextResponse.json({ service })
  } catch (error: unknown) {
    console.error('Create service error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'این نام خدمت برای این سالن قبلاً ثبت شده است' }, { status: 409 })
    }
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
