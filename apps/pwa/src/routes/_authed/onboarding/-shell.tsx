import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SakuraMark } from '@repo/ui/sakura-mark'
import { Spinner } from '@repo/ui/spinner'
import { cn } from '@repo/ui/utils'
import { toPersianDigits } from '@repo/salon-core/persian-digits'
import { handleFormFocusScroll } from '#/lib/scroll-focused-input-into-view'

import { ONBOARDING_STEP_COUNT, stepIndex } from './-steps'
import type { OnboardingStepId } from './-steps'

// Visual language ported from the prototype `OnbShell` (onboarding-kit.jsx):
// thin progress bar, eyebrow tag, big question, pill CTA. Rebuilt on the live
// Saluna semantic tokens (`primary` = plum, `muted-foreground` = sage,
// `ring`/blush = rose accent) — no Saluna raw vars copied.

/** Thin top progress line + Persian fraction counter. */
export function ThinProgress({ current }: { current: OnboardingStepId }) {
  const idx = Math.max(0, stepIndex(current))
  const total = ONBOARDING_STEP_COUNT
  const pct = total > 1 ? (idx / (total - 1)) * 100 : 0
  return (
    <div className="flex items-center gap-3 px-1 py-0.5">
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-blush-soft">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums text-sage-deep">
        {toPersianDigits(String(idx + 1))}/{toPersianDigits(String(total))}
      </span>
    </div>
  )
}

/** Small tag shown above the question. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-blush-soft px-3 py-1 text-[11px] font-semibold text-primary">
      {children}
    </span>
  )
}

/** The big focal "question" headline. */
export function Question({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-2xl font-extrabold leading-snug tracking-tight text-foreground">
      {children}
    </h1>
  )
}

/** Pill-shaped primary CTA ("ادامه"). */
export function PillCTA({
  children,
  onClick,
  disabled = false,
  pending = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  pending?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4',
        'bg-primary text-base font-extrabold text-primary-foreground',
        'shadow-[0_10px_26px_-12px_rgba(0,0,0,0.45)] transition-opacity touch-manipulation',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {pending ? <Spinner className="size-5" /> : children}
      {!pending && <ArrowLeft className="size-5 shrink-0" />}
    </button>
  )
}

/** Skip + submit footer for optional onboarding steps. */
export function OptionalStepFooter({
  onSkip,
  skipping,
  isSubmitting,
  skipLabel = 'فعلاً رد کن',
  submitLabel = 'ادامه',
}: {
  onSkip: () => void
  skipping: boolean
  isSubmitting: boolean
  skipLabel?: string
  submitLabel?: string
}) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onSkip}
        disabled={skipping || isSubmitting}
        className="flex min-h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-2xl px-4 text-sm font-bold text-muted-foreground touch-manipulation disabled:opacity-60"
      >
        {skipping ? <Spinner className="size-5" /> : skipLabel}
      </button>
      <div className="flex-1">
        <PillCTA type="submit" pending={isSubmitting} disabled={skipping}>
          {submitLabel}
        </PillCTA>
      </div>
    </div>
  )
}

/**
 * Plum-hero layout used by the welcome and done screens. Full-bleed plum
 * background with low-contrast sakura petals, centred content, footer CTA.
 */
export function HeroShell({
  children,
  footer,
}: {
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-primary text-primary-foreground">
      <SakuraMark
        size={260}
        color="rgba(255,255,255,0.08)"
        className="pointer-events-none absolute -right-10 -top-10"
      />
      <SakuraMark
        size={200}
        color="rgba(255,255,255,0.06)"
        className="pointer-events-none absolute -bottom-6 -left-8"
      />
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        {children}
      </div>
      <div className="relative px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-3">
        {footer}
      </div>
    </div>
  )
}

/** Light (on-plum) variant of the pill CTA for hero screens. */
export function HeroPillCTA({
  children,
  onClick,
  pending = false,
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  pending?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={cn(
        'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-4',
        'bg-primary-foreground text-base font-extrabold text-primary',
        'shadow-[0_10px_26px_-12px_rgba(0,0,0,0.5)] transition-opacity touch-manipulation',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {pending ? <Spinner className="size-5" /> : children}
      {!pending && <ArrowLeft className="size-5 shrink-0" />}
    </button>
  )
}

/** Step body layout: stacked eyebrow + question + content + footer CTA. */
export function StepBody({
  eyebrow,
  question,
  children,
  footer,
}: {
  eyebrow: ReactNode
  question: ReactNode
  children?: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-5 pb-6 pt-4"
        onFocus={handleFormFocusScroll}
      >
        <Eyebrow>{eyebrow}</Eyebrow>
        <Question>{question}</Question>
        {children}
      </div>
      <div className="border-t border-line-soft bg-card px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3">
        {footer}
      </div>
    </div>
  )
}
