import {
  Activity,
  ClipboardList,
  Gauge,
  HeartHandshake,
  MessageSquareWarning,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
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
    title: 'Operations',
    items: [
      { title: 'Overview', href: '/overview', icon: Gauge, keywords: ['dashboard', 'metrics', 'home'] },
      { title: 'Salons', href: '/salons', icon: Store, keywords: ['tenants', 'status', 'profiles'] },
      { title: 'Users', href: '/users', icon: Users, keywords: ['people', 'accounts', 'memberships'] },
    ],
  },
  {
    title: 'Platform',
    items: [
      { title: 'Catalog Presets', href: '/catalog-presets', icon: Sparkles, keywords: ['services', 'templates'] },
      { title: 'Messaging Health', href: '/messaging-health', icon: MessageSquareWarning, keywords: ['sms', 'telegram', 'deliveries'] },
      { title: 'Support Lookup', href: '/support-lookup', icon: HeartHandshake, keywords: ['appointments', 'requests', 'support'] },
    ],
  },
  {
    title: 'Governance',
    items: [
      { title: 'Audit Log', href: '/audit-log', icon: ScrollText, keywords: ['events', 'reasons', 'history'] },
      { title: 'Platform Admins', href: '/platform-admins', icon: ShieldCheck, keywords: ['roles', 'access', 'owners'] },
      { title: 'Settings', href: '/settings', icon: Settings, keywords: ['preferences', 'admin'] },
    ],
  },
]

export const commandActions = [
  { title: 'Review failed deliveries', href: '/messaging-health', icon: Activity },
  { title: 'Open latest audit events', href: '/audit-log', icon: ClipboardList },
]

export const adminNavItems = adminNavGroups.flatMap((group) => group.items)
