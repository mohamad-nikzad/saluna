import { z } from '@hono/zod-openapi'

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const onboardingActionSchema = z
  .enum([
    'complete',
    'skip',
    'reopen',
    'set-manager-staff',
    'confirm-business-hours',
  ])
  .openapi('OnboardingAction')

export const onboardingSalonSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
  })
  .openapi('OnboardingSalon')

export const onboardingStepsSchema = z
  .object({
    businessHoursSet: z.boolean(),
    servicesAdded: z.boolean(),
    staffAdded: z.boolean(),
    presenceSet: z.boolean(),
    publicPageConfigured: z.boolean(),
    notificationsConfigured: z.boolean(),
  })
  .openapi('OnboardingSteps')

export const onboardingStatusSchema = z
  .object({
    salon: onboardingSalonSchema.nullable(),
    steps: onboardingStepsSchema,
    completedAt: isoDateTimeSchema.nullable(),
    skippedAt: isoDateTimeSchema.nullable(),
  })
  .openapi('OnboardingStatus')

export const onboardingResponseSchema = z
  .object({
    onboarding: onboardingStatusSchema,
  })
  .openapi('OnboardingResponse')

export const onboardingUpdateBodySchema = z
  .object({
    action: onboardingActionSchema,
  })
  .openapi('OnboardingUpdateRequest')
