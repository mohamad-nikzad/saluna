import { NextResponse } from 'next/server'
import { getManagerAppointmentAvailability } from '@repo/database/appointments'
import type { AvailabilityMode } from '@repo/salon-core/availability'
import { dayOfWeekFromDate } from '@repo/salon-core/staff-availability'
import { getTenantManagerRequest } from '@repo/auth/tenant'

function isAvailabilityMode(value: string | null): value is AvailabilityMode {
  return value === 'day' || value === 'nearest'
}

function isIsoDate(value: string | null): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dayOfWeekFromDate(value) >= 0
  )
}

export async function GET(request: Request) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const serviceId = searchParams.get('serviceId')
    const date = searchParams.get('date')
    const staffId = searchParams.get('staffId') ?? undefined

    if (!isAvailabilityMode(mode)) {
      return NextResponse.json({ error: 'نوع جستجو نامعتبر است' }, { status: 400 })
    }

    if (!serviceId) {
      return NextResponse.json({ error: 'خدمت الزامی است' }, { status: 400 })
    }

    if (!isIsoDate(date)) {
      return NextResponse.json({ error: 'تاریخ نامعتبر است' }, { status: 400 })
    }

    const result = await getManagerAppointmentAvailability({
      salonId: user.salonId,
      serviceId,
      date,
      mode,
      staffId,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.response)
  } catch (error) {
    console.error('Manager availability lookup error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
