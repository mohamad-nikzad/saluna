import { useEffect } from 'react'

type VirtualKeyboardLike = {
  overlaysContent: boolean
  boundingRect: DOMRectReadOnly
  addEventListener: (
    type: 'geometrychange',
    listener: (event: Event) => void,
  ) => void
  removeEventListener: (
    type: 'geometrychange',
    listener: (event: Event) => void,
  ) => void
}

declare global {
  interface Navigator {
    virtualKeyboard?: VirtualKeyboardLike
  }
}

export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const vk = navigator.virtualKeyboard
    const previousOverlaysContent = vk?.overlaysContent
    if (vk) vk.overlaysContent = true

    const setInset = (value: number) => {
      const clamped = Math.max(0, Math.round(value))
      root.style.setProperty('--keyboard-inset', `${clamped}px`)
    }

    const updateFromVisualViewport = () => {
      const vv = window.visualViewport
      if (!vv) return
      setInset(window.innerHeight - vv.height - vv.offsetTop)
    }

    const handleGeometryChange = (event: Event) => {
      const target = event.target as VirtualKeyboardLike | null
      setInset(target?.boundingRect?.height ?? 0)
    }

    if (vk) {
      vk.addEventListener('geometrychange', handleGeometryChange)
      setInset(vk.boundingRect?.height ?? 0)
    } else if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateFromVisualViewport)
      window.visualViewport.addEventListener('scroll', updateFromVisualViewport)
      updateFromVisualViewport()
    }

    return () => {
      if (vk) {
        vk.removeEventListener('geometrychange', handleGeometryChange)
        if (previousOverlaysContent !== undefined) {
          vk.overlaysContent = previousOverlaysContent
        }
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateFromVisualViewport)
        window.visualViewport.removeEventListener('scroll', updateFromVisualViewport)
      }
      root.style.removeProperty('--keyboard-inset')
    }
  }, [active])
}
