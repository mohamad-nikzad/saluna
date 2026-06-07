import { useState } from 'react'
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy } from 'lucide-react'
import { cn } from '@repo/ui/utils'

import {
  getApiV1OnboardingQueryKey,
  onboardingQueryOptions,
  useUpdateOnboardingMutation,
  type OnboardingResponse,
} from '#/lib/onboarding-queries'
import { HeroPillCTA, HeroShell } from './-shell'
import { guardStep } from './-steps'

import { brand } from '@repo/brand'

export const Route = createFileRoute('/_authed/onboarding/done')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'done'),
  component: DoneScreen,
})

function DoneScreen() {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const onboardingQuery = useQuery(onboardingQueryOptions())

  const salon = onboardingQuery.data?.onboarding.salon
  const publicPageConfigured =
    onboardingQuery.data?.onboarding.steps.publicPageConfigured ?? false
  const salonName = salon?.name ?? 'سالن شما'
  const slug = salon?.slug ?? ''
  const publicUrl = `${brand.domains.public}/${slug}`

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard may be unavailable (insecure context) — ignore.
    }
  }

  const completeOnboarding = useUpdateOnboardingMutation({ skipToast: true })

  const onComplete = () => {
    completeOnboarding.mutate('complete', {
      onSuccess: async (data) => {
        queryClient.setQueryData<OnboardingResponse>(
          getApiV1OnboardingQueryKey(),
          data,
        )
        await navigate({ to: '/calendar' })
        await router.invalidate()
      },
    })
  }

  return (
    <HeroShell
      footer={
        <HeroPillCTA pending={completeOnboarding.isPending} onClick={onComplete}>
          بزن بریم سراغ اولین نوبت
        </HeroPillCTA>
      }
    >
      <div className="flex size-26 items-center justify-center rounded-full border-2 border-white/40 bg-white/15">
        <div className="flex size-18 items-center justify-center rounded-full bg-primary-foreground text-primary">
          <Check className="size-10" strokeWidth={2.8} />
        </div>
      </div>

      <h1 className="mt-7 text-3xl font-extrabold tracking-tight">
        تمام شد! 🌸
      </h1>
      <p className="mt-3 text-sm leading-loose opacity-85">
        «{salonName}» آماده‌ی پذیرش است.
        {publicPageConfigured ? (
          <>
            <br />
            لینک رزرو شما همین حالا فعال شد.
          </>
        ) : (
          <>
            <br />
            هر زمان خواستید می‌توانید صفحه‌ی عمومی و لینک رزرو را از تنظیمات
            فعال کنید.
          </>
        )}
      </p>

      {publicPageConfigured && slug ? (
        <button
          type="button"
          onClick={() => void onCopy()}
          dir="ltr"
          className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-white/30 bg-white/15 px-4 py-3 text-sm font-bold"
        >
          <span className="min-w-0 flex-1 truncate text-left">{publicUrl}</span>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 text-xs',
              copied ? 'opacity-100' : 'opacity-85',
            )}
          >
            {copied ? (
              <>
                <Check className="size-4" /> کپی شد
              </>
            ) : (
              <>
                <Copy className="size-4" /> کپی
              </>
            )}
          </span>
        </button>
      ) : null}
    </HeroShell>
  )
}
