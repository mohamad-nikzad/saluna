import { startTransition, useEffect, useRef, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { Download, Share, Smartphone } from 'lucide-react'
import { Button } from '@repo/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@repo/ui/drawer'

import { brand, brandCopy } from '@repo/brand'

const FIRST_VISIT_KEY = brand.storage.pwaFirstVisit
const DISMISSED_KEY = brand.storage.pwaInstallDismissed
const VALUE_MOMENT_KEY = brand.storage.pwaInstallQualified
const AUTO_OPENED_KEY = brand.storage.pwaInstallAutoOpened

const VALUE_MOMENT_PATHS = [
  '/calendar',
  '/today',
  '/clients',
  '/dashboard',
  '/retention',
  '/services',
  '/settings',
]

type PromptVariant = 'installable' | 'ios'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isMobileContext() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(max-width: 900px)').matches ||
    navigator.maxTouchPoints > 0
  )
}

function isIosSafari() {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = window.navigator.userAgent
  const isIosDevice =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari =
    /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent)

  return isIosDevice && isSafari
}

function persistDismissal() {
  window.localStorage.setItem(DISMISSED_KEY, '1')
}

export function InstallPrompt() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const shouldAutoOpenRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<PromptVariant>('installable')
  const [isPending, setIsPending] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (VALUE_MOMENT_PATHS.some((path) => pathname.startsWith(path))) {
      window.localStorage.setItem(VALUE_MOMENT_KEY, '1')
    }
  }, [pathname])

  useEffect(() => {
    if (!isMobileContext() || isStandalone()) {
      return
    }

    const wasDismissed = window.localStorage.getItem(DISMISSED_KEY) === '1'
    const isFirstVisit = window.localStorage.getItem(FIRST_VISIT_KEY) !== '1'
    const hasValueMoment = window.localStorage.getItem(VALUE_MOMENT_KEY) === '1'
    const alreadyAutoOpened =
      window.localStorage.getItem(AUTO_OPENED_KEY) === '1'

    window.localStorage.setItem(FIRST_VISIT_KEY, '1')

    if (!hasValueMoment) {
      return
    }

    shouldAutoOpenRef.current = !alreadyAutoOpened || isFirstVisit

    if (isIosSafari()) {
      setVariant('ios')
      setIsSupported(true)

      if (shouldAutoOpenRef.current) {
        window.localStorage.setItem(AUTO_OPENED_KEY, '1')
        startTransition(() => setOpen(true))
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      deferredPromptRef.current = installEvent

      startTransition(() => {
        setVariant('installable')
        setIsSupported(true)
        if (!wasDismissed && shouldAutoOpenRef.current) {
          window.localStorage.setItem(AUTO_OPENED_KEY, '1')
          setOpen(true)
        }
      })
    }

    const handleAppInstalled = () => {
      deferredPromptRef.current = null
      window.localStorage.removeItem(DISMISSED_KEY)
      setOpen(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [pathname])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open) {
      persistDismissal()
      shouldAutoOpenRef.current = false
    }

    setOpen(nextOpen)
  }

  const handleInstall = async () => {
    const deferredPrompt = deferredPromptRef.current

    if (!deferredPrompt) {
      return
    }

    setIsPending(true)

    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      deferredPromptRef.current = null
      if (choice.outcome === 'accepted') {
        window.localStorage.removeItem(DISMISSED_KEY)
        setOpen(false)
      } else {
        persistDismissal()
      }
    } finally {
      setIsPending(false)
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      dismissible={!isPending}
    >
      <DrawerContent className="max-h-[88dvh] rounded-t-[28px] border-border/70 bg-background/98 backdrop-blur">
        <DrawerHeader className="text-start">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              {variant === 'ios' ? (
                <Share className="size-5" />
              ) : (
                <Download className="size-5" />
              )}
            </div>
            <div className="space-y-1">
              <DrawerTitle className="text-lg">
                {brandCopy.installPromptTitle}
              </DrawerTitle>
              <DrawerDescription className="text-sm leading-6">
                بعد از استفاده روزانه، نصبش کنيد تا سريع تر و تمام صفحه در دسترس
                باشد.
              </DrawerDescription>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Smartphone className="size-4 text-primary" />
              {variant === 'ios' ? 'روش نصب در آيفون' : 'چرا نصبش کنيم؟'}
            </div>

            {variant === 'ios' ? (
              <ol className="space-y-2 text-sm leading-6 text-muted-foreground">
                <li>در Safari پايين صفحه روي دکمه اشتراک گذاري بزنيد.</li>
                <li>گزينه Add to Home Screen را انتخاب کنيد.</li>
                <li>
                  در مرحله آخر روي Add بزنيد تا {brand.name.fa} مثل يک اپ باز
                  شود.
                </li>
              </ol>
            ) : (
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                <li>باز شدن سريع تر و بدون نوارهاي اضافي مرورگر</li>
                <li>دسترسي راحت از صفحه اصلي گوشي براي استفاده روزانه</li>
                <li>دريافت به روزرساني هاي جديد با تجربه پايدارتر</li>
              </ul>
            )}
          </div>
        </DrawerHeader>

        <DrawerFooter className="border-t border-border/60 bg-background/95 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {variant === 'installable' ? (
            <Button
              onClick={handleInstall}
              disabled={isPending}
              className="h-12 rounded-2xl text-base font-semibold touch-manipulation"
            >
              {isPending ? 'در حال آماده‌سازی…' : 'نصب برنامه'}
            </Button>
          ) : (
            <DrawerClose asChild>
              <Button className="h-12 rounded-2xl text-base font-semibold touch-manipulation">
                متوجه شدم
              </Button>
            </DrawerClose>
          )}

          <DrawerClose asChild>
            <Button
              variant="ghost"
              className="h-11 rounded-2xl text-sm text-muted-foreground touch-manipulation"
            >
              بعدا
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
