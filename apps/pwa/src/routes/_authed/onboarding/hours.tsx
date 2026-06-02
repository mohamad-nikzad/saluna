import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormRootError } from '@repo/ui/form'
import { DEFAULT_WORKING_DAYS } from '@repo/salon-core/working-days'
import { businessSettingsSchema } from '@repo/salon-core/forms/settings'
import type { BusinessSettingsPayload } from '@repo/salon-core/forms/settings'

import { BusinessHoursFields } from '#/components/business-hours/business-hours-fields'
import { api } from '#/lib/api-client'
import { getMutationErrorMessage } from '#/lib/query-client'
import {
  managerBusinessSettingsQueryKey,
  onboardingQueryKey,
} from '#/lib/query-keys'
import { OptionalStepFooter, StepBody } from './-shell'
import { guardStep, ONBOARDING_STEP_BY_ID } from './-steps'

export const Route = createFileRoute('/_authed/onboarding/hours')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'hours'),
  component: HoursScreen,
})

function HoursScreen() {
  const step = ONBOARDING_STEP_BY_ID.hours
  const navigate = useNavigate()
  const [skipping, setSkipping] = useState(false)

  const businessSettingsQuery = useQuery({
    queryKey: managerBusinessSettingsQueryKey,
    queryFn: ({ signal }) => api.businessSettings.get({ signal }),
  })

  const {
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BusinessSettingsPayload>({
    resolver: zodResolver(businessSettingsSchema),
    defaultValues: {
      workingStart: '09:00',
      workingEnd: '21:00',
      slotDurationMinutes: 30,
      workingDays: DEFAULT_WORKING_DAYS,
    },
  })

  const workingStart = watch('workingStart') ?? '09:00'
  const workingEnd = watch('workingEnd') ?? '21:00'
  const slotDurationMinutes = watch('slotDurationMinutes') ?? 30
  const workingDays = watch('workingDays') ?? DEFAULT_WORKING_DAYS

  useEffect(() => {
    const settings = businessSettingsQuery.data?.settings
    if (settings) {
      reset({
        workingStart: settings.workingStart,
        workingEnd: settings.workingEnd,
        slotDurationMinutes: settings.slotDurationMinutes,
        workingDays: settings.workingDays,
      })
    }
  }, [businessSettingsQuery.data, reset])

  const skipHours = useMutation({
    mutationFn: () => api.onboarding.update('confirm-business-hours'),
    meta: {
      skipToast: true,
      invalidatesQuery: onboardingQueryKey,
    },
    onSuccess: () => {
      void navigate({ to: '/onboarding/services' })
    },
  })

  const saveHours = useMutation({
    mutationFn: (values: BusinessSettingsPayload) =>
      api.businessSettings.update(values),
    meta: {
      skipToast: true,
      invalidatesQuery: [managerBusinessSettingsQueryKey, onboardingQueryKey],
    },
    onSuccess: () => {
      void navigate({ to: '/onboarding/services' })
    },
  })

  const onSkip = () => {
    setSkipping(true)
    skipHours.mutate(undefined, {
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'رد کردن این مرحله انجام نشد'),
        })
        setSkipping(false)
      },
      onSettled: () => {
        setSkipping(false)
      },
    })
  }

  const onSubmit = handleSubmit((values) => {
    saveHours.mutate(values, {
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'ذخیره ساعات کاری انجام نشد'),
        })
      },
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex h-full flex-col">
      <StepBody
        eyebrow={step.eyebrow}
        question={step.question}
        footer={
          <OptionalStepFooter
            onSkip={onSkip}
            skipping={skipping || skipHours.isPending}
            isSubmitting={saveHours.isPending}
            submitLabel="ادامه"
          />
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          روزهای باز را انتخاب کنید و بازه‌ی ساعت کاری را مشخص کنید.
        </p>

        <BusinessHoursFields
          workingStart={workingStart}
          workingEnd={workingEnd}
          slotDurationMinutes={slotDurationMinutes}
          workingDays={workingDays}
          onWorkingStartChange={(value) =>
            setValue('workingStart', value, { shouldValidate: false })
          }
          onWorkingEndChange={(value) =>
            setValue('workingEnd', value, { shouldValidate: false })
          }
          onSlotDurationChange={(value) =>
            setValue('slotDurationMinutes', value, { shouldValidate: false })
          }
          onWorkingDaysChange={(value) =>
            setValue('workingDays', value, { shouldValidate: false })
          }
          errors={errors}
        />

        <FormRootError message={errors.root?.message} />
      </StepBody>
    </form>
  )
}
