import { NextResponse } from 'next/server'
import { completePlaceholderAppointmentClient } from '@repo/database/clients'
import { getTenantManagerRequest } from '@repo/auth/tenant'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const body = await request.json()
    const { name, phone, notes, reassignToExistingClientId } = body

    if (typeof name !== 'string' || typeof phone !== 'string' || !name.trim() || !phone.trim()) {
      return NextResponse.json(
        { error: 'نام و شماره تماس برای تکمیل اطلاعات مشتری الزامی است' },
        { status: 400 }
      )
    }

    const result = await completePlaceholderAppointmentClient({
      salonId: user.salonId,
      appointmentId: id,
      name: name.trim(),
      phone: phone.trim(),
      notes: typeof notes === 'string' ? notes : undefined,
      reassignToExistingClientId:
        typeof reassignToExistingClientId === 'string' ? reassignToExistingClientId : undefined,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
          ...(result.existingClient ? { existingClient: result.existingClient } : {}),
        },
        { status: result.status }
      )
    }

    return NextResponse.json({
      appointment: result.appointment,
      outcome: result.outcome,
    })
  } catch (error) {
    console.error('Complete placeholder client error:', error)
    return NextResponse.json({ error: 'خطای سرور. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
