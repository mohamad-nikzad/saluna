import {
  Gauge,
  ScrollText,
  Settings,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavItem = {
  title: string
  href: string
  icon: LucideIcon
  keywords: string[]
}

export type AdminNavGroup = {
  title: string
  items: AdminNavItem[]
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: 'عملیات',
    items: [
      { title: 'نمای کلی', href: '/overview', icon: Gauge, keywords: ['dashboard', 'metrics', 'home', 'داشبورد', 'آمار'] },
      { title: 'سالن‌ها', href: '/salons', icon: Store, keywords: ['tenants', 'status', 'profiles', 'سالن', 'وضعیت'] },
    ],
  },
  {
    title: 'پلتفرم',
    items: [
      { title: 'قالب‌های کاتالوگ', href: '/catalog-presets', icon: Sparkles, keywords: ['services', 'templates', 'خدمات', 'قالب'] },
    ],
  },
  {
    title: 'حاکمیت',
    items: [
      { title: 'لاگ ممیزی', href: '/audit-log', icon: ScrollText, keywords: ['events', 'reasons', 'history', 'ممیزی', 'رویداد'] },
      { title: 'تنظیمات', href: '/settings', icon: Settings, keywords: ['preferences', 'admin', 'تنظیمات'] },
    ],
  },
]

export const commandActions = [
  { title: 'آخرین رویدادهای ممیزی', href: '/audit-log', icon: ScrollText },
  { title: 'تنظیمات ادمین', href: '/settings', icon: Settings },
]

export const adminNavItems = adminNavGroups.flatMap((group) => group.items)
