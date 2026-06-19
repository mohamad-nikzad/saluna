import type { PlatformRole } from '@repo/api-client/types'
import {
  Gauge,
  ScrollText,
  Settings,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react'

const platformRoleRank: Record<PlatformRole, number> = {
  platform_viewer: 0,
  platform_support: 1,
  platform_admin: 2,
  platform_owner: 3,
}

export function hasMinPlatformRole(
  role: PlatformRole,
  minRole: PlatformRole,
): boolean {
  return platformRoleRank[role] >= platformRoleRank[minRole]
}

export type AdminNavItem = {
  title: string
  href: string
  icon: LucideIcon
  keywords: string[]
  minRole?: PlatformRole
}

export type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: 'عملیات',
    items: [
      { title: 'نمای کلی', href: '/overview', icon: Gauge, keywords: ['dashboard', 'metrics', 'home', 'نمای', 'کلی'] },
      { title: 'سالن‌ها', href: '/salons', icon: Store, keywords: ['tenants', 'status', 'profiles', 'سالن'] },
    ],
  },
  {
    title: 'پلتفرم',
    items: [
      {
        title: 'الگوهای کاتالوگ',
        href: '/catalog-presets',
        icon: Sparkles,
        keywords: ['services', 'templates', 'catalog', 'کاتالوگ', 'الگو'],
        minRole: 'platform_admin',
      },
    ],
  },
  {
    title: 'نظارت',
    items: [
      { title: 'گزارش ممیزی', href: '/audit-log', icon: ScrollText, keywords: ['events', 'reasons', 'history', 'ممیزی', 'گزارش'] },
      {
        title: 'تنظیمات',
        href: '/settings',
        icon: Settings,
        keywords: ['preferences', 'admin', 'تنظیمات'],
        minRole: 'platform_owner',
      },
    ],
  },
]

export const navUserDropdownItems: Array<
  Pick<AdminNavItem, 'title' | 'href' | 'icon' | 'minRole'>
> = [
  { title: 'گزارش ممیزی', href: '/audit-log', icon: ScrollText },
  { title: 'تنظیمات', href: '/settings', icon: Settings, minRole: 'platform_owner' },
]

export const commandActions: Array<
  Pick<AdminNavItem, 'title' | 'href' | 'icon' | 'minRole'>
> = [
  { title: 'رویدادهای اخیر ممیزی', href: '/audit-log', icon: ScrollText },
  {
    title: 'تنظیمات ادمین',
    href: '/settings',
    icon: Settings,
    minRole: 'platform_owner',
  },
]

export const adminNavItems = adminNavGroups.flatMap((group) => group.items)

export function filterNavGroupsByRole(
  groups: AdminNavGroup[],
  role: PlatformRole,
): AdminNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.minRole || hasMinPlatformRole(role, item.minRole),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

export function filterNavItemsByRole<T extends { minRole?: PlatformRole }>(
  items: T[],
  role: PlatformRole,
): T[] {
  return items.filter(
    (item) => !item.minRole || hasMinPlatformRole(role, item.minRole),
  )
}
