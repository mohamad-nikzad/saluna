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

export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const root = document.documentElement
    const keyboard = navigator.virtualKeyboard
    const previousOverlaysContent = keyboard?.overlaysContent
    if (keyboard) keyboard.overlaysContent = true

    const setInset = (value: number) => {
      root.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, Math.round(value))}px`,
      )
    }
    const updateFromViewport = () => {
      const viewport = window.visualViewport
      if (viewport) {
        setInset(window.innerHeight - viewport.height - viewport.offsetTop)
      }
    }
    const updateFromKeyboard = (event: Event) => {
      setInset(
        (event.target as unknown as VirtualKeyboardLike).boundingRect.height,
      )
    }

    if (keyboard) {
      keyboard.addEventListener('geometrychange', updateFromKeyboard)
      setInset(keyboard.boundingRect.height)
    } else {
      window.visualViewport?.addEventListener('resize', updateFromViewport)
      window.visualViewport?.addEventListener('scroll', updateFromViewport)
      updateFromViewport()
    }

    return () => {
      keyboard?.removeEventListener('geometrychange', updateFromKeyboard)
      if (keyboard && previousOverlaysContent !== undefined) {
        keyboard.overlaysContent = previousOverlaysContent
      }
      window.visualViewport?.removeEventListener('resize', updateFromViewport)
      window.visualViewport?.removeEventListener('scroll', updateFromViewport)
      root.style.removeProperty('--keyboard-inset')
    }
  }, [active])
}
