import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { login } from '@repo/auth/auth'

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'شماره موبایل و رمز عبور الزامی است' },
        { status: 400 }
      )
    }

    const result = await login(String(phone).trim(), password)

    if (!result) {
      return NextResponse.json(
        { error: 'شماره موبایل یا رمز عبور اشتباه است' },
        { status: 401 }
      )
    }

    const cookieStore = await cookies()
    cookieStore.set('session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ user: result.user, token: result.token })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
