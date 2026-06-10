import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { Globe, Layers, MapPin } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Spinner } from '@repo/ui/spinner'
import { Switch } from '@repo/ui/switch'
import { cn } from '@repo/ui/utils'
import type {
  ManagerPublicSettingsResult,
  ManagerServiceVisibility,
} from '@repo/api-client/types'
import {
  DEFAULT_PUBLIC_THEME_ID,
  resolvePublicTheme,
} from '@repo/salon-core/public-themes'
import {
  DEFAULT_PUBLIC_LAYOUT_ID,
  PUBLIC_LAYOUTS,
} from '@repo/salon-core/public-layouts'
import { PUBLIC_BIO_MAX_LENGTH } from '@repo/salon-core/forms/public'
import { presenceToInput } from '@repo/salon-core/forms/presence'
import { serviceCategoryName } from '@repo/salon-core/service-catalog'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import type { Service } from '@repo/salon-core/types'

import { PageHeaderBackButton } from '#/components/page-header-back-button'
import { BottomDrawer } from '#/components/public-page/bottom-drawer'
import { PublicBioCard } from '#/components/public-page/public-page-basics'
import { countFilledPresenceFields } from '#/components/public-page/presence-fields'
import { PresenceEditor } from '#/components/public-page/presence-form'
import { LayoutPicker } from '#/components/public-page/layout-picker'
import { LivePreview } from '#/components/public-page/live-preview'
import { monogramFor, publicUrlFor } from '#/components/public-page/public-url'
import { ServicesPanel } from '#/components/public-page/services-panel'
import { SlugEditor } from '#/components/public-page/slug-editor'
import { ThemeStrip } from '#/components/public-page/theme-strip'
import type { ServiceRow } from '#/components/public-page/types'
import {
  getApiV1SalonPublicSettingsQueryKey,
  salonPublicSettingsQueryOptions,
  useUpdateSalonPublicSettingsMutation,
} from '#/lib/salon-public-settings-queries'
import {
  getApiV1SalonProfilePresenceQueryKey,
  salonPresenceQueryOptions,
} from '#/lib/salon-profile-queries'

export const Route = createFileRoute('/_authed/public-page')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'manager') {
      throw redirect({ to: '/today' })
    }
  },
  component: PublicPageRoute,
})

function PublicPageRoute() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [data, setData] = useState<ManagerPublicSettingsResult | null>(null)
  const initializedRef = useRef(false)

  const [enabled, setEnabled] = useState(false)
  const [requests, setRequests] = useState(true)
  const [bio, setBio] = useState('')
  const [themeId, setThemeId] = useState<string>(DEFAULT_PUBLIC_THEME_ID)
  const [layoutId, setLayoutId] = useState<string>(DEFAULT_PUBLIC_LAYOUT_ID)
  const [services, setServices] = useState<ServiceRow[]>([])
  const [copied, setCopied] = useState(false)
  const [copyErrMsg, setCopyErrMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const applyData = (result: ManagerPublicSettingsResult) => {
    setData(result)
    setEnabled(result.settings.enabled)
    setRequests(result.settings.appointmentRequestsEnabled)
    setBio(result.settings.bioText ?? '')
    setThemeId(result.settings.themeId)
    setLayoutId(result.settings.layoutId)
    setServices(
      result.services.map((row: ManagerServiceVisibility) => ({
        serviceId: row.service.id,
        name: row.service.name,
        category: serviceCategoryName(row.service as unknown as Service),
        price: row.service.price ?? 0,
        visible: row.visible,
      })),
    )
    setDirty(false)
  }

  const { data: serverData, isPending } = useQuery(
    salonPublicSettingsQueryOptions(),
  )

  const presenceQuery = useQuery(salonPresenceQueryOptions())

  const presenceFilledCount = useMemo(() => {
    const p = presenceQuery.data?.presence
    if (!p) return 0
    return countFilledPresenceFields(presenceToInput(p))
  }, [presenceQuery.data])

  const savePublicSettings = useUpdateSalonPublicSettingsMutation()

  useEffect(() => {
    if (!serverData || initializedRef.current) return
    applyData(serverData)
    initializedRef.current = true
  }, [serverData])

  const theme = resolvePublicTheme(themeId)
  const currentLayout =
    PUBLIC_LAYOUTS.find((l) => l.id === layoutId) ?? PUBLIC_LAYOUTS[0]
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
      setCopyErrMsg('کپی لینک انجام نشد')
    }
  }

  const save = () => {
    setCopyErrMsg(null)
    savePublicSettings.mutate(
      {
        enabled,
        appointmentRequestsEnabled: requests,
        bioText: bio.trim() || undefined,
        themeId,
        layoutId,
        services: services.map((s) => ({
          serviceId: s.serviceId,
          visible: s.visible,
        })),
      },
      { onSuccess: (result) => applyData(result) },
    )
  }

  if (isPending || !data) {
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
        <PageHeaderBackButton
          aria-label="بازگشت به بیشتر"
          onClick={() => router.history.back()}
        />
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
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-right transition active:scale-[0.99]"
            >
              <div
                className="rounded-full p-[3px]"
                style={{ background: theme.swatch }}
              >
                <div
                  className="grid h-14 w-14 place-items-center rounded-full bg-white text-xl font-bold"
                  style={{ color: theme.primary }}
                >
                  {monogramFor(salonName)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{salonName}</div>
                <div
                  className="mt-0.5 truncate text-[11px] text-muted-foreground"
                  dir="ltr"
                >
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
              <div
                className="rounded-full p-[3px]"
                style={{ background: theme.swatch }}
              >
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
            <SlugEditor
              currentSlug={data.slug}
              publicUrl={url}
              copied={copied}
              onCopy={copyLink}
              onSaved={(result) => {
                applyData(result)
                void queryClient.invalidateQueries({
                  queryKey: getApiV1SalonPublicSettingsQueryKey(),
                })
              }}
            />
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
            <div className="text-xs font-semibold text-muted-foreground">
              تم
            </div>
            <div className="text-[11px] text-muted-foreground">
              {theme.name}
            </div>
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
            <div className="text-xs font-semibold text-muted-foreground">
              چیدمان
            </div>
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

        <PublicBioCard
          bio={bio}
          onBioChange={(value) => {
            setBio(value)
            markDirty()
          }}
          maxLength={PUBLIC_BIO_MAX_LENGTH}
        />

        <BottomDrawer
          title="آدرس و شبکه‌های اجتماعی"
          padded
          trigger={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-card p-3 text-right transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    آدرس و شبکه‌های اجتماعی
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {presenceFilledCount > 0
                      ? `${toPersianDigits(presenceFilledCount)} مورد ثبت شده`
                      : 'هنوز چیزی اضافه نشده'}
                  </div>
                </div>
              </div>
              <span className="rounded-full border px-3 py-1 text-[11px] font-medium text-muted-foreground">
                ویرایش
              </span>
            </button>
          }
        >
          <PresenceEditor
            onSaved={() =>
              void queryClient.invalidateQueries({
                queryKey: getApiV1SalonProfilePresenceQueryKey(),
              })
            }
          />
        </BottomDrawer>

        <BottomDrawer
          title="مدیریت خدمات"
          trigger={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-card p-3 text-right transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    خدمات نمایش‌داده‌شده
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {toPersianDigits(visibleCount)} از{' '}
                    {toPersianDigits(services.length)} فعال
                  </div>
                </div>
              </div>
              <div className="flex -space-x-2">
                {services
                  .filter((s) => s.visible)
                  .slice(0, 4)
                  .map((s) => (
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
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            پیش‌نمایش
          </div>
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
        {copyErrMsg && (
          <p className="mb-2 text-center text-xs text-destructive">
            {copyErrMsg}
          </p>
        )}
        <Button
          className="w-full"
          disabled={savePublicSettings.isPending || !dirty || bioOver}
          onClick={save}
        >
          {savePublicSettings.isPending ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
        </Button>
      </div>
    </div>
  )
}
