import type { ReactNode } from 'react'
import { brand } from '@repo/brand'

import { SalunaMark } from '#/components/brand/saluna-mark'

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-card px-6 py-10 text-foreground sm:bg-background sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 sm:my-auto">
        <div className="flex items-center gap-2.5 sm:px-8">
          <SalunaMark className="size-8" />
          <span className="text-lg font-bold text-primary">
            {brand.name.fa}
          </span>
        </div>
        <section className="min-w-0 bg-card sm:rounded-3xl sm:border sm:border-line-soft sm:p-8">
          <header
            className="mb-7 flex flex-col gap-3 text-right"
            aria-live="polite"
          >
            <h1 className="text-2xl font-bold leading-snug">{title}</h1>
            {description ? (
              <p className="text-sm leading-7 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </header>
          {children}
          {footer ? (
            <footer className="mt-7 border-t border-line-soft pt-5">
              {footer}
            </footer>
          ) : null}
        </section>
      </div>
    </main>
  )
}
