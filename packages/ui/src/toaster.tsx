'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

type Theme = NonNullable<ToasterProps['theme']>

function readDocumentTheme(): Theme {
  if (typeof document === 'undefined') return 'system'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setTheme(readDocumentTheme())
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      dir="rtl"
      visibleToasts={1}
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md',
          description: 'group-[.toast]:opacity-80',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}
