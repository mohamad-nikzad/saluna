'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Globe,
  LayoutGrid,
  Layers,
  Link2,
  List,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@repo/ui/badge'
import { Button } from '@repo/ui/button'
import { Input } from '@repo/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@repo/ui/sheet'
import { Spinner } from '@repo/ui/spinner'
import { Switch } from '@repo/ui/switch'
import { Textarea } from '@repo/ui/textarea'
import { cn } from '@repo/ui/utils'
import type {
  ManagerPublicSettingsResult,
  ManagerServiceVisibilityView,
} from '@repo/database/public'
import {
  DEFAULT_PUBLIC_THEME_ID,
  PUBLIC_THEMES,
  resolvePublicTheme,
  type PublicTheme,
} from '@repo/salon-core/public-themes'
import {
  DEFAULT_PUBLIC_LAYOUT_ID,
  PUBLIC_LAYOUTS,
} from '@repo/salon-core/public-layouts'
import { PUBLIC_BIO_MAX_LENGTH } from '@repo/salon-core/forms/public'
import {
  serviceCategoryName,
} from '@repo/salon-core/service-catalog'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('failed')
  return res.json()
}

type ServiceRow = {
  serviceId: string
  name: string
  category: string
  price: number
  visible: boolean
}

const tomansFormatter = new Intl.NumberFormat('fa-IR')
const formatPrice = (n: number) => `${tomansFormatter.format(n)} تومان`

function monogramFor(name: string): string {
  return Array.from(name.trim())[0] ?? '?'
}

function publicUrlFor(slug: string): string {
  if (typeof window === 'undefined') return `/salons/${slug}`
  const origin = window.location.origin.replace(/\/\/app\./, '//')
  return `${origin}/salons/${slug}`
}

export default function PublicPageRoute() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR<ManagerPublicSettingsResult>(
    '/api/salon-public-settings',
    fetcher,
  )

  const [enabled, setEnabled] = useState(false)
  const [requests, setRequests] = useState(true)
  const [bio, setBio] = useState('')
  const [themeId, setThemeId] = useState<string>(DEFAULT_PUBLIC_THEME_ID)
  const [layoutId, setLayoutId] = useState<string>(DEFAULT_PUBLIC_LAYOUT_ID)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!data) return
    setEnabled(data.settings.enabled)
    setRequests(data.settings.appointmentRequestsEnabled)
    setBio(data.settings.bioText ?? '')
    setThemeId(data.settings.themeId)
    setLayoutId(data.settings.layoutId)
    setServices(
      data.services.map((row: ManagerServiceVisibilityView) => ({
        serviceId: row.service.id,
        name: row.service.name,
        category: serviceCategoryName(row.service),
        price: row.service.price,
        visible: row.visible,
      })),
    )
    setDirty(false)
  }, [data])

  const theme = resolvePublicTheme(themeId)
  const currentLayout =
    PUBLIC_LAYOUTS.find((l) => l.id === layoutId) ?? PUBLIC_LAYOUTS[0]!
  const visibleCount = services.filter((s) => s.visible).length
  const url = data ? publicUrlFor(data.slug) : ''
  const salonName = data?.salonName ?? ''

  const markDirty = () => setDirty(true)
  const updateService = (id: string, visible: boolean) => {
    setServices((prev) =>
      prev.map((s) => (s.serviceId === id ? { ...s, visible } : s)),
    )
    markDirty()
  }
  const setAllVisible = (visible: boolean, category?: string) => {
    setServices((prev) =>
      prev.map((s) =>
        !category || s.category === category ? { ...s, visible } : s,
      ),
    )
    markDirty()
  }

  const copyLink = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErrMsg('کپی لینک انجام نشد')
    }
  }

  const save = async () => {
    setErrMsg(null)
    setSaving(true)
    try {
      const payload = {
        enabled,
        appointmentRequestsEnabled: requests,
        bioText: bio.trim() || null,
        themeId,
        layoutId,
        services: services.map((s) => ({
          serviceId: s.serviceId,
          visible: s.visible,
        })),
      }
      const res = await fetch('/api/salon-public-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setErrMsg(body.error ?? 'ذخیره تنظیمات انجام نشد')
        return
      }
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const bioOver = bio.length > PUBLIC_BIO_MAX_LENGTH

  return (
    <div className="flex h-full flex-col bg-background" dir="rtl">
      <header className="flex items-center gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"
          aria-label="بازگشت"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">صفحه عمومی</h1>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-3 pb-32">
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl border-2 p-4 transition',
            enabled
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-muted-foreground/20 bg-muted/30',
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full',
                enabled
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {enabled ? 'صفحه عمومی فعال است' : 'صفحه عمومی غیرفعال است'}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {enabled
                  ? 'برای همه قابل مشاهده'
                  : 'با فعال‌سازی، لینک عمومی منتشر می‌شود'}
              </div>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v)
              markDirty()
            }}
          />
        </div>

        <BottomDrawer
          title="ویرایش هویت سالن"
          padded
          trigger={
            <button className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-right transition active:scale-[0.99]">
              <div className="rounded-full p-[3px]" style={{ background: theme.swatch }}>
                <div
                  className="grid h-14 w-14 place-items-center rounded-full bg-white text-xl font-bold"
                  style={{ color: theme.primary }}
                >
                  {monogramFor(salonName)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{salonName}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground" dir="ltr">
                  {url}
                </div>
              </div>
              <span className="rounded-full border px-3 py-1 text-[11px] font-medium text-muted-foreground">
                ویرایش
              </span>
            </button>
          }
        >
          <div className="flex flex-col gap-5">
            <div className="grid place-items-center">
              <div className="rounded-full p-[3px]" style={{ background: theme.swatch }}>
                <div
                  className="grid h-24 w-24 place-items-center rounded-full bg-white text-3xl font-bold"
                  style={{ color: theme.primary }}
                >
                  {monogramFor(salonName)}
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              نشان از نام سالن ساخته می‌شود. برای تغییر، نام سالن را در تنظیمات
              راه‌اندازی ویرایش کنید.
            </p>
            <div>
              <div className="mb-1 text-sm font-medium">لینک عمومی</div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <span dir="ltr" className="flex-1 truncate text-xs">{url}</span>
                <Button size="sm" variant="outline" className="h-8" onClick={copyLink}>
                  {copied ? (
                    <>
                      <Check className="ml-1 h-3 w-3" />
                      کپی شد
                    </>
                  ) : (
                    <>
                      <Copy className="ml-1 h-3 w-3" />
                      کپی
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="text-sm font-medium">پذیرش درخواست رزرو</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  نمایش دکمه «درخواست رزرو» در صفحه عمومی
                </div>
              </div>
              <Switch
                checked={requests}
                onCheckedChange={(v) => {
                  setRequests(v)
                  markDirty()
                }}
              />
            </div>
          </div>
        </BottomDrawer>

        <div className="rounded-2xl bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground">تم</div>
            <div className="text-[11px] text-muted-foreground">{theme.name}</div>
          </div>
          <ThemeStrip
            value={themeId}
            onChange={(id) => {
              setThemeId(id)
              markDirty()
            }}
          />
        </div>

        <div className="rounded-2xl bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground">چیدمان</div>
            <div className="text-[11px] text-muted-foreground">
              {currentLayout.name}
            </div>
          </div>
          <LayoutPicker
            value={layoutId}
            onChange={(id) => {
              setLayoutId(id)
              markDirty()
            }}
          />
        </div>

        <div className="rounded-2xl bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground">درباره</div>
            <span
              className={cn(
                'text-[11px] tabular-nums',
                bioOver ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {toPersianDigits(bio.length)}/{toPersianDigits(PUBLIC_BIO_MAX_LENGTH)}
            </span>
          </div>
          <Textarea
            rows={3}
            value={bio}
            maxLength={PUBLIC_BIO_MAX_LENGTH + 50}
            onChange={(e) => {
              setBio(e.target.value)
              markDirty()
            }}
            placeholder="چند خط معرفی کوتاه از سالن…"
            className="resize-none rounded-lg bg-muted/30 px-3 py-2.5 leading-relaxed"
          />
        </div>

        <BottomDrawer
          title="مدیریت خدمات"
          trigger={
            <button className="flex w-full items-center justify-between gap-3 rounded-2xl bg-card p-3 text-right transition active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">خدمات نمایش‌داده‌شده</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {toPersianDigits(visibleCount)} از {toPersianDigits(services.length)} فعال
                  </div>
                </div>
              </div>
              <div className="flex -space-x-2">
                {services.filter((s) => s.visible).slice(0, 4).map((s) => (
                  <div
                    key={s.serviceId}
                    className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card"
                  >
                    {Array.from(s.name.trim())[0] ?? '?'}
                  </div>
                ))}
              </div>
            </button>
          }
        >
          <ServicesPanel
            services={services}
            onToggle={updateService}
            onSetAllVisible={setAllVisible}
          />
        </BottomDrawer>

        <div className="rounded-2xl bg-card p-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">پیش‌نمایش</div>
          <LivePreview
            theme={theme}
            layoutId={layoutId}
            salonName={salonName}
            bio={bio}
            services={services}
          />
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        {errMsg && (
          <p className="mb-2 text-center text-xs text-destructive">{errMsg}</p>
        )}
        <Button
          className="w-full"
          disabled={saving || !dirty || bioOver}
          onClick={save}
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
        </Button>
      </div>
    </div>
  )
}

function ThemeStrip({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {PUBLIC_THEMES.map((th) => {
        const active = th.id === value
        return (
          <button
            key={th.id}
            onClick={() => onChange(th.id)}
            className={cn(
              'flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border-2 p-2 transition',
              active ? 'border-foreground' : 'border-transparent',
            )}
          >
            <div className="relative h-14 w-14 rounded-xl" style={{ background: th.swatch }}>
              {active && (
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background ring-2 ring-card">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{th.name}</span>
          </button>
        )
      })}
    </div>
  )
}

function LayoutPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PUBLIC_LAYOUTS.map((lay) => {
        const active = lay.id === value
        const Icon = lay.id === 'agenda' ? LayoutGrid : List
        return (
          <button
            key={lay.id}
            onClick={() => onChange(lay.id)}
            className={cn(
              'flex flex-col gap-1.5 rounded-xl border-2 p-3 text-right transition',
              active ? 'border-foreground bg-muted/40' : 'border-transparent bg-muted/20',
            )}
          >
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4" />
              {active ? (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-foreground text-background">
                  <Check className="h-2.5 w-2.5" />
                </span>
              ) : null}
            </div>
            <span className="text-xs font-semibold">{lay.name}</span>
            <span className="text-[10px] leading-4 text-muted-foreground">
              {lay.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ServicesPanel({
  services,
  onToggle,
  onSetAllVisible,
}: {
  services: ServiceRow[]
  onToggle: (id: string, visible: boolean) => void
  onSetAllVisible: (visible: boolean, category?: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')

  const grouped = useMemo(() => {
    const q = query.trim()
    const filtered = services.filter((s) => {
      if (q && !s.name.includes(q)) return false
      if (filter === 'visible' && !s.visible) return false
      if (filter === 'hidden' && s.visible) return false
      return true
    })
    const map = new Map<string, ServiceRow[]>()
    for (const s of filtered) {
      const arr = map.get(s.category) ?? []
      arr.push(s)
      map.set(s.category, arr)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fa'))
  }, [services, query, filter])

  const visibleCount = services.filter((s) => s.visible).length

  return (
    <div className="pb-5">
      <div className="sticky top-0 z-10 flex flex-col gap-2.5 bg-background/95 px-5 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی خدمت…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="پاک کردن"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
            {(['all', 'visible', 'hidden'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1.5 transition',
                  filter === f && 'bg-card font-medium shadow-sm',
                )}
              >
                {f === 'all' ? 'همه' : f === 'visible' ? 'فعال' : 'مخفی'}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {toPersianDigits(visibleCount)}/{toPersianDigits(services.length)} فعال
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pt-3">
        {grouped.map(([cat, items]) => {
          const visibleInCat = items.filter((s) => s.visible).length
          const allOn = visibleInCat === items.length
          return (
            <div key={cat} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cat}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {toPersianDigits(visibleInCat)}/{toPersianDigits(items.length)}
                  </Badge>
                </div>
                <button
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => onSetAllVisible(!allOn, cat)}
                >
                  {allOn ? 'مخفی کردن همه' : 'نمایش همه'}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 p-2">
                {items.map((s) => (
                  <button
                    key={s.serviceId}
                    onClick={() => onToggle(s.serviceId, !s.visible)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-right transition',
                      s.visible
                        ? 'border-foreground/15 bg-background'
                        : 'border-dashed border-border bg-muted/30 opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {s.visible ? (
                        <Eye className="h-4 w-4 shrink-0 text-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="text-right">
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatPrice(s.price)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            هیچ خدمتی پیدا نشد.
          </p>
        )}
      </div>
    </div>
  )
}

function BottomDrawer({
  trigger,
  title,
  padded = false,
  children,
}: {
  trigger: React.ReactNode
  title: string
  padded?: boolean
  children: React.ReactNode
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col gap-0 p-0">
        <SheetHeader className="border-b py-4 pr-12 pl-5">
          <SheetTitle className="text-right">{title}</SheetTitle>
        </SheetHeader>
        <div className={cn('flex-1 overflow-auto', padded && 'px-5 py-5')}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function LivePreview({
  theme,
  layoutId,
  salonName,
  bio,
  services,
}: {
  theme: PublicTheme
  layoutId: string
  salonName: string
  bio: string
  services: ServiceRow[]
}) {
  const allVisible = services.filter((s) => s.visible)
  const totalVisible = allVisible.length
  const isAgenda = layoutId !== 'inline'
  const limit = isAgenda ? 6 : 5
  const visible = allVisible.slice(0, limit)

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ background: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <div className="h-16" style={{ background: theme.swatch }} />
      <div className="-mt-8 px-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl border-4 bg-white text-xl font-bold shadow"
          style={{ borderColor: theme.bg, color: theme.primary }}
        >
          {monogramFor(salonName)}
        </div>
        <div className="mt-2 text-sm font-bold">{salonName}</div>
        <p className="mt-1 line-clamp-2 text-[11px] opacity-70">
          {bio || 'بدون توضیحات'}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-4 text-xs opacity-60">خدمتی نمایش داده نشده</p>
      ) : isAgenda ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 px-4 pb-4">
          {visible.map((s) => (
            <div
              key={s.serviceId}
              className="flex items-center gap-2 rounded-lg bg-white/70 p-2 text-[11px]"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                style={{ background: `${theme.primary}1a`, color: theme.primary }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="truncate font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-1.5 px-4 pb-4">
          {visible.map((s) => (
            <div
              key={s.serviceId}
              className="flex items-center justify-between rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px]"
            >
              <span>{s.name}</span>
              <span style={{ color: theme.primary }} className="font-medium">
                {formatPrice(s.price)}
              </span>
            </div>
          ))}
        </div>
      )}
      {totalVisible > limit && (
        <div className="px-4 pb-4 text-center text-[11px] opacity-60">
          + {toPersianDigits(totalVisible - limit)} خدمت دیگر
        </div>
      )}
    </div>
  )
}
