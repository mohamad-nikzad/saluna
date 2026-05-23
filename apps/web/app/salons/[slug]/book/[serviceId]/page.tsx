import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time'
import { PUBLIC_REQUEST_WINDOW_DAYS } from '@repo/salon-core/forms/public'
import { resolvePublicTheme } from '@repo/salon-core/public-themes'
import {
  fetchPublicSalon,
  PublicApiError,
} from '../../../_lib/public-api'
import { BookingClient } from './booking-client'

export const dynamic = 'force-dynamic'

type Params = { slug: string; serviceId: string }

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug, serviceId } = await params
  try {
    const view = await fetchPublicSalon(slug)
    const service = view.services.find((s) => s.id === serviceId)
    if (!service) return { title: 'خدمت یافت نشد | سالورا' }
    return { title: `رزرو ${service.name} | ${view.salon.name}` }
  } catch {
    return { title: 'رزرو | سالورا' }
  }
}

export default async function BookServicePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug, serviceId } = await params

  let salon
  try {
    salon = await fetchPublicSalon(slug)
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound()
    throw error
  }

  const service = salon.services.find((s) => s.id === serviceId)
  if (!service) notFound()
  if (!salon.publicSettings.appointmentRequestsEnabled) notFound()

  const today = salonTodayYmd()
  const dates: string[] = []
  for (let i = 0; i <= PUBLIC_REQUEST_WINDOW_DAYS; i += 1) {
    dates.push(addDaysYmd(today, i))
  }

  const theme = resolvePublicTheme(salon.publicSettings.themeId)
  const accent = theme.primary

  return (
    <main
      dir="rtl"
      className="min-h-dvh bg-[#fdf5f8] text-[#3f2730]"
      style={{ ['--salon-accent' as never]: accent }}
    >
      <header className="mx-auto w-full max-w-3xl px-5 pb-4 pt-8 sm:px-8">
        <Link
          href={`/salons/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-[#7a2a40] hover:underline"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          بازگشت به {salon.salon.name}
        </Link>
        <h1 className="mt-4 text-xl font-extrabold text-[#3f2730] sm:text-2xl">
          رزرو {service.name}
        </h1>
      </header>

      <BookingClient
        slug={slug}
        service={{
          id: service.id,
          name: service.name,
          duration: service.duration,
          price: service.price,
        }}
        dates={dates}
      />
    </main>
  )
}
