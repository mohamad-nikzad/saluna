import type { Client } from '@repo/salon-core/types'

import { personInitials } from '#/lib/roster-visuals'

export const VIP_LABEL = 'VIP'

export function isVip(client: Pick<Client, 'tags'>) {
  return (client.tags ?? []).some((tag) => tag.label === VIP_LABEL)
}

export function clientAccent(
  client: Pick<Client, 'tags'>,
  needsFollowUp = false,
) {
  if (isVip(client)) return 'var(--saloora-rose)'
  if (needsFollowUp) return 'var(--amber)'
  return 'var(--sky)'
}

export function tagTone(label: string) {
  if (label === VIP_LABEL) return 'rose' as const
  if (label.includes('پیگیری')) return 'danger' as const
  if (label.includes('غیرفعال')) return 'neutral' as const
  return 'sky' as const
}

export function ClientAvatar({
  name,
  accent,
  size = 42,
}: {
  name: string
  accent: string
  size?: number
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.32),
        background: `color-mix(in oklch, ${accent} 18%, transparent)`,
        color: accent,
      }}
    >
      {personInitials(name)}
    </div>
  )
}
