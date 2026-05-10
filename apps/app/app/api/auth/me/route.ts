import { NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@repo/auth/auth'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return NextResponse.json(
        { error: 'وارد نشده‌اید' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
