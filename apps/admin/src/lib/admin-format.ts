export function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

export function number(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  return 0
}

export function formatDate(value: unknown): string {
  const raw = text(value)
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatRole(role: string): string {
  const roles: Record<string, string> = {
    platform_owner: 'مالک',
    platform_admin: 'ادمین',
    platform_support: 'پشتیبان',
    platform_viewer: 'بیننده',
  }
  return roles[role] ?? role
}

export function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('fa-IR').format(number(value))
}
