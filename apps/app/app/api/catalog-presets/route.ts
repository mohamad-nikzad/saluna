import { NextResponse } from 'next/server'

import { getTenantRequest } from '@repo/auth/tenant-next'
import { listActiveCatalogPresets } from '@repo/database/catalog-presets'

export async function GET(request: Request) {
  try {
    const tenant = await getTenantRequest(request)
    if (!tenant.ok) return tenant.response
    const { user } = tenant

    const presets = await listActiveCatalogPresets(user.salonId)
    return NextResponse.json({ presets })
  } catch (error) {
    console.error('List catalog presets error:', error)
    return NextResponse.json(
      { error: 'خطای سرور. لطفاً دوباره تلاش کنید.' },
      { status: 500 },
    )
  }
}
