import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Phone } from 'lucide-react'
import { Input } from '@repo/ui/input'
import { Field, FieldError, FieldLabel } from '@repo/ui/field'
import { FormRootError } from '@repo/ui/form'
import { displayPhone } from '@repo/salon-core/phone'
import { staffCreateSchema } from '@repo/salon-core/forms/staff'
import type { StaffCreateFormInput } from '@repo/salon-core/forms/staff'

import { useAuth } from '#/lib/auth'
import { getMutationErrorMessage } from '#/lib/query-client'
import {
  getApiV1OnboardingQueryKey,
  onboardingQueryOptions,
  useUpdateOnboardingMutation,
  type OnboardingResponse,
} from '#/lib/onboarding-queries'
import { useCreateStaffMutation } from '#/lib/staff-queries'
import { PillCTA, StepBody } from './-shell'
import { guardStep, ONBOARDING_STEP_BY_ID } from './-steps'

export const Route = createFileRoute('/_authed/onboarding/staff')({
  beforeLoad: ({ context }) => guardStep(context.queryClient, 'staff'),
  component: StaffScreen,
})

function StaffScreen() {
  const step = ONBOARDING_STEP_BY_ID.staff
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refresh: refreshAuth } = useAuth()
  const [soloPending, setSoloPending] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StaffCreateFormInput>({
    resolver: zodResolver(staffCreateSchema) as Resolver<StaffCreateFormInput>,
    defaultValues: {
      name: '',
      phone: '',
      role: 'staff',
    },
  })

  const name = watch('name')
  const phone = watch('phone')
  const hasStaffDraft = name.trim().length > 0 || phone.trim().length > 0

  const createStaff = useCreateStaffMutation({ skipToast: true })

  const setManagerStaff = useUpdateOnboardingMutation({ skipToast: true })

  const onSubmit = handleSubmit((values) => {
    createStaff.mutate(values, {
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'افزودن پرسنل انجام نشد'),
        })
      },
      onSuccess: async () => {
        await queryClient.fetchQuery(onboardingQueryOptions())
        await refreshAuth()
        await navigate({ to: '/onboarding/presence' })
      },
    })
  })

  const onSolo = () => {
    setSoloPending(true)
    setManagerStaff.mutate('set-manager-staff', {
      onError: (err) => {
        setError('root', {
          message: getMutationErrorMessage(err, 'ثبت انجام نشد'),
        })
      },
      onSuccess: async (data) => {
        queryClient.setQueryData<OnboardingResponse>(
          getApiV1OnboardingQueryKey(),
          data,
        )
        await refreshAuth()
        await navigate({ to: '/onboarding/presence' })
      },
      onSettled: () => {
        setSoloPending(false)
      },
    })
  }

  const pending = createStaff.isPending || soloPending

  const onContinue = () => {
    if (hasStaffDraft) {
      void onSubmit()
      return
    }
    void onSolo()
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onContinue()
      }}
      noValidate
      className="flex h-full flex-col"
    >
      <StepBody
        eyebrow={step.eyebrow}
        question="چه کسی کنار شماست؟"
        footer={
          <PillCTA type="submit" pending={pending}>
            ادامه
          </PillCTA>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          اولین عضو تیم را اضافه کنید تا نوبت‌ها به او اختصاص پیدا کنند.
        </p>

        <div className="flex flex-col gap-4 rounded-2xl border border-line-soft bg-card p-4">
          <Field>
            <FieldLabel htmlFor="onboarding-staff-name">
              نام و نام خانوادگی
            </FieldLabel>
            <Input
              id="onboarding-staff-name"
              placeholder="مثلاً نرگس کاظمی"
              disabled={pending}
              className="h-11 text-right"
              {...register('name')}
            />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="onboarding-staff-phone">
              شماره موبایل
            </FieldLabel>
            <div className="relative">
              <Phone className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="onboarding-staff-phone"
                type="tel"
                value={displayPhone(phone)}
                onChange={(event) => setValue('phone', event.target.value)}
                placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                inputMode="numeric"
                disabled={pending}
                dir="rtl"
                className="h-11 pr-9 text-right tabular-nums"
              />
            </div>
            {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
          </Field>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          اگر فعلاً پرسنلی اضافه نکنید، ادامه یعنی خودتان مسئول نوبت‌ها هستید.
        </p>

        <FormRootError message={errors.root?.message} />
      </StepBody>
    </form>
  )
}
