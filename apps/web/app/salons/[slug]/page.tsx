import { notFound } from 'next/navigation'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { PUBLIC_REQUEST_WINDOW_DAYS } from '@repo/salon-core/forms/public'
import { resolvePublicTheme } from '@repo/salon-core/public-themes'
import { resolvePublicLayout } from '@repo/salon-core/public-layouts'
import {
  fetchPublicSalon,
  PublicApiError,
  type PublicSalonView,
} from '../_lib/public-api'
import { InlineLayout, type PublicLayoutProps } from './_layouts/InlineLayout'
import { AgendaLayout } from './_layouts/AgendaLayout'

export const dynamic = 'force-dynamic'

type Params = { slug: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  try {
    const view = await fetchPublicSalon(slug)
    return {
      title: `${view.salon.name} | سالورا`,
      description: view.publicSettings.bioText ?? undefined,
    }
  } catch {
    return { title: 'سالن یافت نشد | سالورا' }
  }
}

export default async function PublicSalonPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  let view: PublicSalonView
  try {
    view = await fetchPublicSalon(slug)
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound()
    throw error
  }

  const theme = resolvePublicTheme(view.publicSettings.themeId)
  const layout = resolvePublicLayout(view.publicSettings.layoutId)

  const today = salonTodayYmd()
  const dates: string[] = []
  for (let i = 0; i <= PUBLIC_REQUEST_WINDOW_DAYS; i += 1) {
    dates.push(addDaysYmd(today, i))
  }

  const layoutProps: PublicLayoutProps = {
    slug: view.salon.slug,
    services: view.services,
    dates,
    theme,
    bookingEnabled: view.publicSettings.appointmentRequestsEnabled,
    salonName: view.salon.name,
    phone: view.salon.phone,
    bio: view.publicSettings.bioText,
  }

  return layout.id === 'inline' ? (
    <InlineLayout {...layoutProps} />
  ) : (
    <AgendaLayout {...layoutProps} />
  )
}
