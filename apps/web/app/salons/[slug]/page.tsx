import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Phone } from 'lucide-react'
import type { Service } from '@repo/salon-core/types'
import { serviceCategoryName } from '@repo/salon-core/service-catalog'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { resolvePublicTheme } from '@repo/salon-core/public-themes'
import {
  fetchPublicSalon,
  PublicApiError,
  type PublicSalonView,
} from '../_lib/public-api'
import { formatDuration, formatPrice } from '../_lib/format'

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
  const groups = groupByCategory(view.services)
  const bookingEnabled = view.publicSettings.appointmentRequestsEnabled

  return (
    <main
      dir="rtl"
      className="min-h-dvh"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        ['--salon-accent' as never]: theme.primary,
      }}
    >
      <SalonHeader view={view} theme={theme} />

      <section className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
        {!bookingEnabled ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            در حال حاضر امکان رزرو آنلاین در این سالن غیرفعال است. لطفاً برای
            هماهنگی نوبت با سالن تماس بگیرید.
          </div>
        ) : null}

        {view.services.length === 0 ? (
          <p className="rounded-2xl bg-white/80 p-6 text-center text-sm opacity-70">
            خدمتی برای نمایش وجود ندارد.
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key}>
                <h2
                  className="mb-3 text-base font-extrabold"
                  style={{ color: theme.primary }}
                >
                  {group.label}
                </h2>
                <ul className="space-y-3">
                  {group.services.map((service) => (
                    <li
                      key={service.id}
                      className="flex flex-col gap-3 rounded-2xl bg-white/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-base font-extrabold">
                          {service.name}
                        </p>
                        <p className="mt-1 text-xs opacity-70">
                          {formatDuration(service.duration)} ·{' '}
                          {formatPrice(service.price)}
                        </p>
                        {service.description ? (
                          <p className="mt-2 text-xs leading-6 opacity-80">
                            {service.description}
                          </p>
                        ) : null}
                      </div>
                      {bookingEnabled ? (
                        <Link
                          href={`/salons/${view.salon.slug}/book/${service.id}`}
                          className="inline-flex justify-center rounded-md px-5 py-2 text-sm font-extrabold text-white shadow-md transition hover:opacity-90"
                          style={{ backgroundColor: 'var(--salon-accent)' }}
                        >
                          رزرو
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function monogramFor(name: string): string {
  return Array.from(name.trim())[0] ?? '?'
}

function SalonHeader({
  view,
  theme,
}: {
  view: PublicSalonView
  theme: ReturnType<typeof resolvePublicTheme>
}) {
  const { salon, publicSettings } = view
  return (
    <header className="relative isolate">
      <div
        className="h-32 w-full sm:h-40"
        style={{ background: theme.swatch }}
      />
      <div className="mx-auto -mt-12 w-full max-w-3xl px-5 sm:px-8">
        <div
          className="rounded-3xl border bg-white/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] backdrop-blur sm:p-6"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-4 bg-white text-2xl font-extrabold shadow sm:h-20 sm:w-20 sm:text-3xl"
              style={{ borderColor: theme.bg, color: theme.primary }}
            >
              {monogramFor(salon.name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold sm:text-2xl">
                {salon.name}
              </h1>
              {salon.phone ? (
                <a
                  href={`tel:${salon.phone}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm hover:underline"
                  style={{ color: theme.primary }}
                  dir="ltr"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {toPersianDigits(salon.phone)}
                </a>
              ) : null}
            </div>
          </div>
          {publicSettings.bioText ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-7 opacity-80">
              {publicSettings.bioText}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function groupByCategory(services: Service[]) {
  const groups = new Map<string, { key: string; label: string; services: Service[] }>()
  for (const service of services) {
    const label = serviceCategoryName(service)
    const key = service.categoryId ?? service.category
    if (!groups.has(key)) groups.set(key, { key, label, services: [] })
    groups.get(key)!.services.push(service)
  }
  return Array.from(groups.values())
}
