import type { PublicTheme } from '@repo/salon-core/public-themes'
import type { Service } from '@repo/salon-core/types'

export type PublicLayoutProps = {
  slug: string
  services: Service[]
  dates: string[]
  theme: PublicTheme
  bookingEnabled: boolean
  salonName: string
  phone: string | null
  bio: string | null
}
