'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, Check, Copy, Globe } from 'lucide-react'
import { Button } from '@repo/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/card'
import { Field, FieldError, FieldLabel } from '@repo/ui/field'
import { Input } from '@repo/ui/input'
import { Switch } from '@repo/ui/switch'
import { Textarea } from '@repo/ui/textarea'
import { Spinner } from '@repo/ui/spinner'
import type {
  ManagerPublicSettingsResult,
  ManagerServiceVisibilityView,
} from '@repo/database/public'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('failed')
  return res.json()
}

type ServiceRow = {
  serviceId: string
  name: string
  visible: boolean
  sortOrder: number
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/

export function PublicPageSettingsSection() {
  const { data, isLoading, mutate } = useSWR<ManagerPublicSettingsResult>(
    '/api/salon-public-settings',
    fetcher,
  )

  const [enabled, setEnabled] = useState(false)
  const [appointmentRequestsEnabled, setAppointmentRequestsEnabled] = useState(true)
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [bioText, setBioText] = useState('')
  const [accentColor, setAccentColor] = useState('')
  const [services, setServices] = useState<ServiceRow[]>([])
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!data) return
    setEnabled(data.settings.enabled)
    setAppointmentRequestsEnabled(data.settings.appointmentRequestsEnabled)
    setLogoUrl(data.settings.logoUrl ?? '')
    setBannerUrl(data.settings.bannerUrl ?? '')
    setBioText(data.settings.bioText ?? '')
    setAccentColor(data.settings.accentColor ?? '')
    setServices(
      data.services.map((row: ManagerServiceVisibilityView, idx) => ({
        serviceId: row.service.id,
        name: row.service.name,
        visible: row.visible,
        sortOrder:
          row.sortOrder === Number.MAX_SAFE_INTEGER ? idx : row.sortOrder,
      })),
    )
  }, [data])

  const move = (idx: number, dir: -1 | 1) => {
    setServices((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      const a = next[idx]
      const b = next[target]
      if (!a || !b) return prev
      next[idx] = b
      next[target] = a
      return next.map((row, i) => ({ ...row, sortOrder: i }))
    })
  }

  const toggleVisible = (idx: number) => {
    setServices((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, visible: !row.visible } : row,
      ),
    )
  }

  const save = async () => {
    setErrMsg(null)
    if (accentColor && !HEX_RE.test(accentColor.trim())) {
      setErrMsg('رنگ باید کد هگزادسیمال ۶ رقمی باشد')
      return
    }
    setSaving(true)
    try {
      const payload = {
        enabled,
        appointmentRequestsEnabled,
        logoUrl: logoUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        bioText: bioText.trim() || null,
        accentColor: accentColor.trim() || null,
        services: services.map((row, idx) => ({
          serviceId: row.serviceId,
          visible: row.visible,
          sortOrder: idx,
        })),
      }
      const res = await fetch('/api/salon-public-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrMsg(body.error ?? 'ذخیره تنظیمات انجام نشد')
        return
      }
      await mutate()
    } finally {
      setSaving(false)
    }
  }

  const publicUrl =
    data && data.slug
      ? `${typeof window !== 'undefined' ? window.location.origin.replace(/app\./, '') : ''}/salons/${data.slug}`
      : ''

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErrMsg('کپی لینک انجام نشد')
    }
  }

  if (isLoading || !data) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            صفحه عمومی
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-4">
          <Spinner className="h-5 w-5" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          صفحه عمومی
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">فعال‌سازی صفحه عمومی</span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">پذیرش درخواست رزرو</span>
          <Switch
            checked={appointmentRequestsEnabled}
            onCheckedChange={setAppointmentRequestsEnabled}
          />
        </div>

        {enabled && publicUrl && (
          <div className="flex items-center gap-2 rounded-md bg-muted/40 p-2">
            <span className="flex-1 truncate text-xs text-muted-foreground" dir="ltr">
              {publicUrl}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={copyLink}
            >
              {copied ? (
                <>
                  <Check className="ml-1 h-3.5 w-3.5" />
                  کپی شد
                </>
              ) : (
                <>
                  <Copy className="ml-1 h-3.5 w-3.5" />
                  کپی لینک
                </>
              )}
            </Button>
          </div>
        )}

        <Field>
          <FieldLabel>لوگو (URL)</FieldLabel>
          <Input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            dir="ltr"
            placeholder="https://"
          />
        </Field>

        <Field>
          <FieldLabel>تصویر بنر (URL)</FieldLabel>
          <Input
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            dir="ltr"
            placeholder="https://"
          />
        </Field>

        <Field>
          <FieldLabel>درباره سالن</FieldLabel>
          <Textarea
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            rows={3}
            placeholder="معرفی کوتاه سالن"
          />
        </Field>

        <Field>
          <FieldLabel>رنگ اصلی</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={
                accentColor && HEX_RE.test(accentColor)
                  ? accentColor.startsWith('#')
                    ? accentColor
                    : `#${accentColor}`
                  : '#000000'
              }
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-16 p-1"
            />
            <Input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              dir="ltr"
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </Field>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            ترتیب و نمایش خدمات
          </p>
          {services.length === 0 ? (
            <p className="text-xs text-muted-foreground">خدمتی ثبت نشده است.</p>
          ) : (
            <div className="space-y-1">
              {services.map((row, idx) => (
                <div
                  key={row.serviceId}
                  className="flex items-center gap-2 rounded-md border border-border/60 p-2"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                      aria-label="بالا"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === services.length - 1}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
                      aria-label="پایین"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="flex-1 truncate text-sm">{row.name}</span>
                  <Switch
                    checked={row.visible}
                    onCheckedChange={() => toggleVisible(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {errMsg && <FieldError>{errMsg}</FieldError>}

        <Button
          size="sm"
          className="w-full"
          disabled={saving}
          onClick={save}
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات صفحه عمومی'}
        </Button>
      </CardContent>
    </Card>
  )
}
