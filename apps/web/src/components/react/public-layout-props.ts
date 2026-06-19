import type { PublicTheme } from '@repo/salon-core/public-themes'
import type { Service } from '@repo/salon-core/types'
import type { SalonPresenceFields } from '@repo/salon-core/forms/presence'

export type PublicLayoutProps = {
  slug: string
  services: Service[]
  dates: string[]
  theme: PublicTheme
  bookingEnabled: boolean
  salonName: string
  phone: string | null
  bio: string | null
  presence: Required<SalonPresenceFields>
}
