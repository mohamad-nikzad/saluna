import type { Client } from '@repo/salon-core/types'

export const VIP_LABEL = 'VIP'

export function isVip(client: Pick<Client, 'tags'>) {
  return (client.tags ?? []).some((tag) => tag.label === VIP_LABEL)
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0]}${parts[1][0]}`
}

export function clientAccent(client: Pick<Client, 'tags'>, needsFollowUp = false) {
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
      {getInitials(name)}
    </div>
  )
}
