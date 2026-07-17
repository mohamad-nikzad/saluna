import { z } from '@hono/zod-openapi'
import {
  staffCreateRequestSchema,
  staffScheduleRequestSchema,
  staffServiceIdsSchema,
  staffUpdateSchema,
} from '@repo/salon-core/forms/staff'

function bodyFromCoreSchema<T extends z.ZodType>(
  name: string,
  shape: z.ZodRawShape,
  coreSchema: T,
) {
  return z
    .object(shape)
    .openapi(name)
    .superRefine((data, ctx) => {
      const result = coreSchema.safeParse(data)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: issue.path,
          })
        }
      }
    })
    .transform((data) => coreSchema.parse(data))
}

const isoDateTimeSchema = z.string().datetime().or(z.string())

export const staffRoleSchema = z.enum(['staff', 'manager']).openapi('StaffRole')

export const staffUserSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    name: z.string(),
    fullName: z.string().optional(),
    nickname: z.string().nullable().optional(),
    role: staffRoleSchema,
    color: z.string(),
    phone: z.string(),
    createdAt: isoDateTimeSchema,
    serviceIds: z.array(z.string()).nullable().optional(),
    inviteStatus: z.enum(['pending']).nullable().optional(),
  })
  .passthrough()
  .openapi('StaffUser')

export const staffCreateBodySchema = bodyFromCoreSchema(
  'StaffCreateRequest',
  {
    name: z.string().openapi({ example: 'نرگس کاظمی' }),
    phone: z.string().openapi({ example: '09121234567' }),
    role: staffRoleSchema.optional().openapi({ example: 'staff' }),
  },
  staffCreateRequestSchema,
)

export const staffUpdateBodySchema = bodyFromCoreSchema(
  'StaffUpdateRequest',
  {
    name: z.string().openapi({ example: 'نرگس کاظمی' }),
    nickname: z.string().nullable().optional().openapi({ example: 'نرگس' }),
    phone: z.string().openapi({ example: '09121234567' }),
    role: staffRoleSchema.openapi({ example: 'staff' }),
    color: z.string().optional().openapi({ example: 'plum' }),
  },
  staffUpdateSchema,
)

export const staffServiceIdsBodySchema = bodyFromCoreSchema(
  'StaffServiceIdsRequest',
  {
    serviceIds: z
      .array(z.string())
      .nullable()
      .optional()
      .openapi({ example: ['svc-1', 'svc-2'] }),
  },
  staffServiceIdsSchema,
)

export const staffScheduleDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    active: z.boolean(),
    workingStart: z.string().openapi({ example: '09:00' }),
    workingEnd: z.string().openapi({ example: '19:00' }),
  })
  .openapi('StaffScheduleDay')

export const staffScheduleBodySchema = bodyFromCoreSchema(
  'StaffScheduleUpdateRequest',
  {
    schedule: z.array(staffScheduleDaySchema).openapi({
      description: 'Weekly schedule rows (one per day of week)',
    }),
  },
  staffScheduleRequestSchema,
)

export const staffScheduleRowSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    staffId: z.string(),
    dayOfWeek: z.number().int(),
    workingStart: z.string(),
    workingEnd: z.string(),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('StaffSchedule')

export const businessHoursSchema = z
  .object({
    workingStart: z.string(),
    workingEnd: z.string(),
    slotDurationMinutes: z.number().int(),
    workingDays: z.number().int(),
  })
  .passthrough()
  .openapi('BusinessHours')

export const staffListResponseSchema = z
  .object({
    staff: z.array(staffUserSchema),
  })
  .openapi('StaffListResponse')

export const staffCreateResponseSchema = z
  .object({
    user: staffUserSchema,
  })
  .openapi('StaffCreateResponse')

export const staffMemberResponseSchema = z
  .object({
    staff: staffUserSchema,
  })
  .openapi('StaffMemberResponse')

export const successResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .openapi('SuccessResponse')

export const staffScheduleBundleResponseSchema = z
  .object({
    schedule: z.array(staffScheduleRowSchema),
    businessHours: businessHoursSchema,
  })
  .openapi('StaffScheduleBundleResponse')

export const staffScheduleUpdateResponseSchema = z
  .object({
    schedule: z.array(staffScheduleRowSchema),
  })
  .openapi('StaffScheduleUpdateResponse')

export const bookingAvailabilityQuerySchema = z
  .object({
    date: z
      .string()
      .optional()
      .openapi({
        param: { name: 'date', in: 'query' },
        example: '2026-06-07',
      }),
    startTime: z
      .string()
      .optional()
      .openapi({
        param: { name: 'startTime', in: 'query' },
        example: '10:00',
      }),
    endTime: z
      .string()
      .optional()
      .openapi({
        param: { name: 'endTime', in: 'query' },
        example: '11:00',
      }),
  })
  .openapi('StaffBookingAvailabilityQuery')

export const staffBookingAvailabilityRowSchema = z
  .object({
    staffId: z.string(),
    available: z.boolean(),
    reason: z.string().optional(),
  })
  .openapi('StaffBookingAvailabilityRow')

export const staffBookingAvailabilityResponseSchema = z
  .object({
    staff: z.array(staffBookingAvailabilityRowSchema),
  })
  .openapi('StaffBookingAvailabilityResponse')

export const cancelStaffInviteResponseSchema = z
  .object({
    success: z.literal(true),
    invite: z.object({
      id: z.string(),
      status: z.string(),
      revokedAt: isoDateTimeSchema.nullable(),
    }),
    profile: z.object({
      id: z.string(),
      name: z.string(),
      active: z.boolean(),
    }),
  })
  .openapi('CancelStaffInviteResponse')

export const resendStaffInviteResponseSchema = z
  .object({
    inviteToken: z.string(),
    invite: z.object({
      id: z.string(),
      status: z.string(),
      expiresAt: isoDateTimeSchema,
      lastDeliveredAt: isoDateTimeSchema.nullable(),
    }),
    profile: z.object({
      id: z.string(),
      name: z.string(),
    }),
  })
  .openapi('ResendStaffInviteResponse')
