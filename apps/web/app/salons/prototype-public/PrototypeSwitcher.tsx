'use client'

// PROTOTYPE — switcher bar; do NOT ship to production.
import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type VariantInfo = { key: string; name: string }

export function PrototypeSwitcher({ variants }: { variants: VariantInfo[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get('variant') ?? variants[0]!.key
  const idx = Math.max(0, variants.findIndex((v) => v.key === current))
  const currentVariant = variants[idx] ?? variants[0]!

  function go(delta: number) {
    const next = variants[(idx + delta + variants.length) % variants.length]!
    const search = new URLSearchParams(params.toString())
    search.set('variant', next.key)
    router.replace(`${pathname}?${search.toString()}`)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.target as HTMLElement | null)?.isContentEditable) return
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, params])

  if (process.env.NODE_ENV === 'production') return null

  return (
    <div
      dir="ltr"
      className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 select-none"
    >
      <div className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1.5 text-white shadow-2xl ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-full p-1.5 hover:bg-white/10"
          aria-label="Previous variant"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-44 px-3 text-center text-xs font-medium">
          <span className="opacity-60">Variant </span>
          <span className="font-bold">{currentVariant.key}</span>
          <span className="opacity-60"> — {currentVariant.name}</span>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-full p-1.5 hover:bg-white/10"
          aria-label="Next variant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] text-zinc-500">← / → to switch</p>
    </div>
  )
}
