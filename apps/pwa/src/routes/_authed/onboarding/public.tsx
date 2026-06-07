import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormRootError } from '@repo/ui/form'
import {
  PUBLIC_ONBOARDING_BIO_MAX_LENGTH,
  publicPageOnboardingSchema,
} from '@repo/salon-core/forms/public'
import type {
  PublicPageOnboardingInput,
  PublicPageOnboardingPayload,
} from '@repo/salon-core/forms/public'

import { PublicPageBasicsFields } from '#/components/public-page/public-page-basics'
import { getMutationErrorMessage } from '#/lib/query-client'
import { getApiV1OnboardingQueryKey } from '#/lib/onboarding-queries'
import {
  getApiV1SalonPublicSettingsQueryKey,
  salonPublicSettingsQueryOptions,
  useUpdateSalonPublicSettingsMutation,
} from '#/lib/salon-public-settings-queries'
import { OptionalStepFooter, StepBody } from './-shell'
import { guardStep, ONBOARDING_STEP_BY_ID } from './-steps'

export const Route = createFileRoute('/_authed/onboarding/public')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'public'),
  component: PublicScreen,
})

function PublicScreen() {
  const step = ONBOARDING_STEP_BY_ID.public
  const navigate = useNavigate()
  const [skipping, setSkipping] = useState(false)

  const publicSettingsQuery = useQuery(salonPublicSettingsQueryOptions())

  const {
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PublicPageOnboardingInput, unknown, PublicPageOnboardingPayload>({
    resolver: zodResolver(publicPageOnboardingSchema),
    defaultValues: { enabled: true, bioText: '' },
  })

  const enabled = watch('enabled')
  const bioText = watch('bioText') ?? ''

  useEffect(() => {
    const settings = publicSettingsQuery.data?.settings
    if (settings) {
      reset({ enabled: settings.enabled, bioText: settings.bioText ?? '' })
    }
  }, [publicSettingsQuery.data, reset])

  const savePublicSettings = useUpdateSalonPublicSettingsMutation({
    skipToast: true,
    invalidatesQuery: [
      getApiV1SalonPublicSettingsQueryKey(),
      getApiV1OnboardingQueryKey(),
    ],
  })

  const onSubmit = handleSubmit((formValues) => {
    savePublicSettings.mutate(formValues, {
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'ذخیره صفحه عمومی انجام نشد'),
        })
      },
      onSuccess: () => {
        void navigate({ to: '/onboarding/notifications' })
      },
    })
  })

  const onSkip = async () => {
    setSkipping(true)
    try {
      await navigate({ to: '/onboarding/notifications' })
    } finally {
      setSkipping(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex h-full flex-col">
      <StepBody
        eyebrow={step.eyebrow}
        question={step.question}
        footer={
          <OptionalStepFooter
            onSkip={() => void onSkip()}
            skipping={skipping}
            isSubmitting={savePublicSettings.isPending}
          />
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          با یک لینک، مشتری‌ها می‌توانند آنلاین درخواست نوبت بدهند.
        </p>

        <PublicPageBasicsFields
          enabled={enabled}
          onEnabledChange={(value) =>
            setValue('enabled', value, { shouldValidate: false })
          }
          bio={bioText}
          onBioChange={(value) =>
            setValue('bioText', value, { shouldValidate: true })
          }
          bioMaxLength={PUBLIC_ONBOARDING_BIO_MAX_LENGTH}
          bioError={errors.bioText?.message}
        />

        <FormRootError message={errors.root?.message} />
      </StepBody>
    </form>
  )
}
