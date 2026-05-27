import { NextResponse } from 'next/server'

import { getTenantManagerRequest } from '@repo/auth/tenant-next'
import { applyCatalogPreset } from '@repo/database/catalog-presets'
import { applyCatalogPresetBodySchema } from '@repo/salon-core/forms/catalog-preset'

import { validationErrorResponse } from '../../../validation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await getTenantManagerRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const { id } = await params
    const parsed = applyCatalogPresetBodySchema.safeParse(await request.json())
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await applyCatalogPreset({
      salonId: user.salonId,
      presetId: id,
      selection: parsed.data.selection,
    })
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Apply catalog preset error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg.includes('not found') || msg.includes('inactive')) {
      return NextResponse.json(
        { error: 'قالب یافت نشد یا غیرفعال است' },
        { status: 404 },
      )
    }
    if (msg.includes('collides')) {
      return NextResponse.json(
        { error: 'این قالب با دسته‌های موجود سالن همپوشانی دارد' },
        { status: 409 },
      )
    }
    if (msg.includes('selection is empty')) {
      return NextResponse.json(
        { error: 'حداقل یک خدمت برای افزودن انتخاب کنید' },
        { status: 400 },
      )
    }
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'برخی از خدمات این قالب در سالن قبلاً ثبت شده‌اند' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    )
  }
}
