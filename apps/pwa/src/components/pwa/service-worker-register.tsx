import { useEffect, useRef } from 'react'
import { ToastAction } from '@repo/ui/toast'
import { toast } from '@repo/ui/use-toast'

import { withPwaAssetVersion } from '#/lib/pwa-assets'

const ASSET_SCRIPT_PATTERN = /\/assets\/[a-zA-Z0-9_-]+\.js/

function extractAssetScript(html: string): string | null {
  const match = ASSET_SCRIPT_PATTERN.exec(html)
  return match ? match[0] : null
}

function getCurrentAssetScript(): string | null {
  for (const script of Array.from(document.scripts)) {
    const src = script.getAttribute('src') ?? ''
    const match = ASSET_SCRIPT_PATTERN.exec(src)
    if (match) {
      return match[0]
    }
  }
  return null
}

export function ServiceWorkerRegister() {
  const refreshingRef = useRef(false)
  const updateToastIdRef = useRef<string | null>(null)
  const appUpdateCheckInFlightRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    if (!import.meta.env.PROD) {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))

        if ('caches' in window) {
          const cacheNames = await window.caches.keys()
          await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)))
        }
      })()

      return
    }

    let registrationCleanup = () => {}

    const promptForUpdate = (onUpdate: () => void) => {
      if (updateToastIdRef.current) {
        return
      }

      let toastId = ''
      const updateToast = toast({
        duration: Infinity,
        title: 'نسخه جدید آماده است',
        description: 'برای دریافت آخرین تغییرات، برنامه را به روز کنید.',
        onOpenChange: (open) => {
          if (!open && updateToastIdRef.current === toastId) {
            updateToastIdRef.current = null
          }
        },
        action: (
          <ToastAction
            altText="Update app"
            onClick={() => {
              updateToast.dismiss()
              onUpdate()
            }}
          >
            به روز رسانی
          </ToastAction>
        ),
      })

      toastId = updateToast.id
      updateToastIdRef.current = toastId
    }

    const promptForServiceWorkerUpdate = (registration: ServiceWorkerRegistration) => {
      if (!registration.waiting) {
        return
      }

      promptForUpdate(() => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      })
    }

    const promptForAppShellUpdate = () => {
      promptForUpdate(() => {
        refreshingRef.current = true
        window.location.reload()
      })
    }

    const currentAssetScript = getCurrentAssetScript()

    const checkForAppShellUpdate = async () => {
      if (appUpdateCheckInFlightRef.current) {
        return
      }

      appUpdateCheckInFlightRef.current = true

      try {
        const response = await fetch('/', {
          cache: 'no-store',
          credentials: 'include',
          headers: {
            Accept: 'text/html',
            'Cache-Control': 'no-cache',
          },
        })

        if (
          !response.ok ||
          !response.headers.get('content-type')?.includes('text/html')
        ) {
          return
        }

        const nextMarkup = await response.text()
        const nextAssetScript = extractAssetScript(nextMarkup)

        if (
          currentAssetScript &&
          nextAssetScript &&
          currentAssetScript !== nextAssetScript
        ) {
          promptForAppShellUpdate()
        }
      } catch {
        /* ignore transient update check failures */
      } finally {
        appUpdateCheckInFlightRef.current = false
      }
    }

    const handleControllerChange = () => {
      if (refreshingRef.current) {
        return
      }

      refreshingRef.current = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    navigator.serviceWorker
      .register(withPwaAssetVersion('/sw.js'), { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const recheckForUpdates = () => {
          void checkForAppShellUpdate()
          void registration.update().then(() => {
            if (registration.waiting && navigator.serviceWorker.controller) {
              promptForServiceWorkerUpdate(registration)
            }
          })
        }

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            recheckForUpdates()
          }
        }

        const handleUpdateFound = () => {
          const newWorker = registration.installing

          if (!newWorker) {
            return
          }

          const handleStateChange = () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promptForServiceWorkerUpdate(registration)
            }
          }

          newWorker.addEventListener('statechange', handleStateChange)
        }

        if (registration.waiting && navigator.serviceWorker.controller) {
          promptForServiceWorkerUpdate(registration)
        }

        registration.addEventListener('updatefound', handleUpdateFound)
        window.addEventListener('focus', recheckForUpdates)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        const updateInterval = window.setInterval(recheckForUpdates, 10 * 60 * 1000)
        recheckForUpdates()

        registrationCleanup = () => {
          registration.removeEventListener('updatefound', handleUpdateFound)
          window.removeEventListener('focus', recheckForUpdates)
          document.removeEventListener('visibilitychange', handleVisibilityChange)
          window.clearInterval(updateInterval)
        }
      })
      .catch(() => {})

    return () => {
      registrationCleanup()
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      )
    }
  }, [])

  return null
}
