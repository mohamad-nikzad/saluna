'use client'

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

/**
 * While `active` is true, expose the soft keyboard's height as a CSS variable
 * (`--keyboard-inset`) on `document.documentElement`. Pair with
 * `padding-bottom: var(--keyboard-inset, 0px)` to keep form footers above the
 * keyboard without letting the browser reflow the surrounding layout.
 *
 * Strategy:
 * - Chromium: opts the page into `virtualKeyboard.overlaysContent` (keyboard
 *   floats over content instead of resizing the viewport) and reads the exact
 *   keyboard height from the `geometrychange` event.
 * - iOS Safari / others: falls back to `VisualViewport`, deriving the inset
 *   from `innerHeight - visualViewport.height - offsetTop`.
 *
 * Previous values are restored on cleanup so other parts of the app keep the
 * default `interactive-widget: resizes-content` behaviour.
 */
export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const vk = navigator.virtualKeyboard
    const previousOverlaysContent = vk?.overlaysContent
    if (vk) {
      vk.overlaysContent = true
    }

    const setInset = (value: number) => {
      const clamped = Math.max(0, Math.round(value))
      root.style.setProperty('--keyboard-inset', `${clamped}px`)
    }

    const updateFromVisualViewport = () => {
      const vv = window.visualViewport
      if (!vv) return
      const inset = window.innerHeight - vv.height - vv.offsetTop
      setInset(inset)
    }

    const handleGeometryChange = (event: Event) => {
      const target = event.target as VirtualKeyboardLike | null
      const height = target?.boundingRect?.height ?? 0
      setInset(height)
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
        window.visualViewport.removeEventListener(
          'resize',
          updateFromVisualViewport,
        )
        window.visualViewport.removeEventListener(
          'scroll',
          updateFromVisualViewport,
        )
      }
      root.style.removeProperty('--keyboard-inset')
    }
  }, [active])
}
