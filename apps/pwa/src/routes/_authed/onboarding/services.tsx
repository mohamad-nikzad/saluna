import { useCallback, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { toPersianDigits } from '@repo/salon-core/persian-digits'

import { CatalogPresetPicker } from '#/components/catalog-preset-picker'
import type {
  CatalogPresetPickerHandle,
  CatalogPresetPickerState,
} from '#/components/catalog-preset-picker'
import {
  getApiV1OnboardingQueryKey,
  onboardingQueryOptions,
} from '#/lib/onboarding-queries'
import {
  getApiV1ServicesQueryKey,
  servicesListQueryOptions,
} from '#/lib/services-queries'
import { PillCTA, StepBody } from './-shell'
import { guardStep, ONBOARDING_STEP_BY_ID } from './-steps'

// Required step — cannot advance until at least one active service exists.
export const Route = createFileRoute('/_authed/onboarding/services')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'services'),
  component: ServicesScreen,
})

function ServicesScreen() {
  const step = ONBOARDING_STEP_BY_ID.services
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const servicesQuery = useQuery(servicesListQueryOptions())
  const pickerRef = useRef<CatalogPresetPickerHandle>(null)
  const [pickerState, setPickerState] = useState<CatalogPresetPickerState>({
    applying: false,
    canApply: false,
    selectedCount: 0,
    selectedPresetName: null,
  })
  const [continuing, setContinuing] = useState(false)

  const activeCount = (servicesQuery.data ?? []).filter((s) => s.active).length
  const hasService = activeCount > 0

  const refreshServices = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getApiV1ServicesQueryKey(),
    })
    await queryClient.invalidateQueries({
      queryKey: getApiV1OnboardingQueryKey(),
    })
    await servicesQuery.refetch()
  }, [queryClient, servicesQuery])

  const onContinue = async () => {
    setContinuing(true)
    try {
      if (!hasService) {
        const applied =
          (await pickerRef.current?.applySelectedPreset()) ?? false
        if (!applied) return
        await refreshServices()
      }

      await queryClient.fetchQuery(onboardingQueryOptions())
      await navigate({ to: '/onboarding/staff' })
    } finally {
      setContinuing(false)
    }
  }

  return (
    <StepBody
      eyebrow={step.eyebrow}
      question="چه خدماتی ارائه می‌دهید؟"
      footer={
        <PillCTA
          disabled={!hasService && !pickerState.canApply}
          pending={continuing || pickerState.applying}
          onClick={() => void onContinue()}
        >
          ادامه
        </PillCTA>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        یک قالب آماده را انتخاب کنید تا خدمت‌هایش خودکار ساخته شوند. حداقل یک
        خدمت برای ادامه لازم است.
      </p>

      {hasService && (
        <div className="flex items-center gap-2 rounded-xl bg-blush-soft px-3.5 py-2.5 text-sm font-bold text-primary">
          <Check className="size-4" />
          {toPersianDigits(activeCount)} خدمت فعال ثبت شد
        </div>
      )}

      <CatalogPresetPicker
        ref={pickerRef}
        showApplyButton={false}
        onStateChange={setPickerState}
        onApplied={() => void refreshServices()}
      />
    </StepBody>
  )
}
