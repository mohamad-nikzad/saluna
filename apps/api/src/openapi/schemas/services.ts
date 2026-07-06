import { z } from '@hono/zod-openapi'
import { applyCatalogPresetBodySchema } from '@repo/salon-core/forms/catalog-preset'
import {
  serviceAddonCreateSchema,
  serviceAddonUpdateSchema,
  serviceCategoryCreateSchema,
  serviceCategoryUpdateSchema,
  serviceCreateSchema,
  serviceFamilyCreateSchema,
  serviceFamilyUpdateSchema,
  servicePackageComponentsUpdateSchema,
  servicePackageBookingCreateSchema,
  servicePackageCreateSchema,
  servicePackageUpdateSchema,
  serviceUpdateSchema,
} from '@repo/salon-core/forms/service'

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

export const includeInactiveQuerySchema = z
  .object({
    all: z
      .string()
      .optional()
      .openapi({
        param: { name: 'all', in: 'query' },
        example: '1',
        description:
          'When set to "1" and the caller is a manager, inactive catalog rows are included',
      }),
  })
  .openapi('IncludeInactiveQuery')

export const legacyServiceCategoryKeySchema = z
  .enum(['hair', 'nails', 'skincare', 'spa'])
  .openapi('LegacyServiceCategoryKey')

export const serviceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: legacyServiceCategoryKeySchema,
    categoryId: z.string(),
    categoryName: z.string().nullable().optional(),
    duration: z.number().int(),
    price: z.number(),
    color: z.string(),
    active: z.boolean(),
    description: z.string().nullable().optional(),
  })
  .passthrough()
  .openapi('Service')

export const serviceCategorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServiceCategory')

export const serviceFamilySchema = z
  .object({
    id: z.string(),
    categoryId: z.string(),
    categoryName: z.string().nullable().optional(),
    name: z.string(),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServiceFamily')

export const serviceAddonScopeSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('all'),
    }),
    z.object({
      type: z.literal('category'),
      categoryId: z.string(),
      categoryName: z.string(),
      active: z.boolean(),
    }),
    z.object({
      type: z.literal('service'),
      serviceId: z.string(),
      serviceName: z.string(),
      active: z.boolean(),
    }),
  ])
  .openapi('ServiceAddonScope')

export const serviceAddonSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    name: z.string(),
    priceDelta: z.number(),
    durationDelta: z.number(),
    active: z.boolean(),
    sortOrder: z.number().int(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(serviceAddonScopeSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServiceAddon')

export const servicePackageComponentSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    packageId: z.string(),
    serviceId: z.string(),
    sortOrder: z.number().int(),
    service: serviceSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServicePackageComponent')

export const servicePackageSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    categoryId: z.string().nullable(),
    categoryName: z.string().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    active: z.boolean(),
    priceOverride: z.number().nullable(),
    sortOrder: z.number().int(),
    components: z.array(servicePackageComponentSchema),
    totalDuration: z.number().int(),
    componentPriceTotal: z.number(),
    resolvedPrice: z.number(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServicePackage')

const servicePackageBookingTaskAppointmentSchema = z
  .object({
    id: z.string(),
    clientId: z.string(),
    staffId: z.string(),
    serviceId: z.string(),
    bookedServiceName: z.string(),
    bookedServiceDuration: z.number().int(),
    bookedServicePrice: z.number(),
    bookedTotalDuration: z.number().int(),
    bookedTotalPrice: z.number(),
    bookedAddonCount: z.number().int(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    status: z.string(),
    notes: z.string().nullable().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServicePackageTaskAppointment')

export const servicePackageBookingTaskSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    packageBookingId: z.string(),
    packageComponentId: z.string(),
    serviceId: z.string(),
    appointmentId: z.string(),
    staffId: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    sortOrder: z.number().int(),
    appointment: servicePackageBookingTaskAppointmentSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServicePackageBookingTask')

export const servicePackageBookingSchema = z
  .object({
    id: z.string(),
    salonId: z.string(),
    packageId: z.string(),
    clientId: z.string(),
    leadStaffId: z.string(),
    date: z.string(),
    bookedPackageName: z.string(),
    bookedPackagePrice: z.number(),
    status: z.string(),
    notes: z.string().nullable().optional(),
    createdByUserId: z.string().nullable().optional(),
    tasks: z.array(servicePackageBookingTaskSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .passthrough()
  .openapi('ServicePackageBooking')

export const serviceCreateBodySchema = bodyFromCoreSchema(
  'ServiceCreateRequest',
  {
    name: z.string().openapi({ example: 'رنگ مو' }),
    categoryId: z.string().openapi({ example: 'cat-1' }),
    category: legacyServiceCategoryKeySchema.optional(),
    duration: z.number().int().openapi({ example: 90 }),
    price: z.number().openapi({ example: 450000 }),
    color: z.string().optional(),
    active: z.boolean().optional(),
    description: z.string().optional(),
    id: z.string().optional(),
  },
  serviceCreateSchema,
)

export const serviceUpdateBodySchema = bodyFromCoreSchema(
  'ServiceUpdateRequest',
  {
    name: z.string().optional(),
    categoryId: z.string().optional(),
    duration: z.number().int().optional(),
    price: z.number().optional(),
    color: z.string().optional(),
    active: z.boolean().optional(),
    description: z.string().optional(),
  },
  serviceUpdateSchema,
)

export const serviceCategoryCreateBodySchema = bodyFromCoreSchema(
  'ServiceCategoryCreateRequest',
  {
    name: z.string().openapi({ example: 'مو' }),
    active: z.boolean().optional(),
    id: z.string().optional(),
  },
  serviceCategoryCreateSchema,
)

export const serviceCategoryUpdateBodySchema = bodyFromCoreSchema(
  'ServiceCategoryUpdateRequest',
  {
    name: z.string().optional(),
    active: z.boolean().optional(),
  },
  serviceCategoryUpdateSchema,
)

export const serviceFamilyCreateBodySchema = bodyFromCoreSchema(
  'ServiceFamilyCreateRequest',
  {
    categoryId: z.string().openapi({ example: 'cat-1' }),
    name: z.string().openapi({ example: 'رنگ و لایت' }),
    active: z.boolean().optional(),
    id: z.string().optional(),
  },
  serviceFamilyCreateSchema,
)

export const serviceFamilyUpdateBodySchema = bodyFromCoreSchema(
  'ServiceFamilyUpdateRequest',
  {
    categoryId: z.string().optional(),
    name: z.string().optional(),
    active: z.boolean().optional(),
  },
  serviceFamilyUpdateSchema,
)

const serviceAddonScopeInputOpenApiSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('all'),
    }),
    z.object({
      type: z.literal('category'),
      categoryId: z.string(),
    }),
    z.object({
      type: z.literal('service'),
      serviceId: z.string(),
    }),
  ])
  .openapi('ServiceAddonScopeInput')

export const serviceAddonCreateBodySchema = bodyFromCoreSchema(
  'ServiceAddonCreateRequest',
  {
    name: z.string().openapi({ example: 'طراحی ناخن' }),
    priceDelta: z.number().optional(),
    durationDelta: z.number().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(serviceAddonScopeInputOpenApiSchema).optional(),
    id: z.string().optional(),
  },
  serviceAddonCreateSchema,
)

export const serviceAddonUpdateBodySchema = bodyFromCoreSchema(
  'ServiceAddonUpdateRequest',
  {
    name: z.string().optional(),
    priceDelta: z.number().optional(),
    durationDelta: z.number().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    description: z.string().optional(),
    color: z.string().nullable().optional(),
    scopes: z.array(serviceAddonScopeInputOpenApiSchema).optional(),
  },
  serviceAddonUpdateSchema,
)

export const servicePackageCreateBodySchema = bodyFromCoreSchema(
  'ServicePackageCreateRequest',
  {
    name: z.string().openapi({ example: 'پکیج عروس' }),
    categoryId: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    active: z.boolean().optional(),
    priceOverride: z.number().nullable().optional(),
    sortOrder: z.number().int().optional(),
    id: z.string().optional(),
  },
  servicePackageCreateSchema,
)

export const servicePackageUpdateBodySchema = bodyFromCoreSchema(
  'ServicePackageUpdateRequest',
  {
    name: z.string().optional(),
    categoryId: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    active: z.boolean().optional(),
    priceOverride: z.number().nullable().optional(),
    sortOrder: z.number().int().optional(),
  },
  servicePackageUpdateSchema,
)

export const servicePackageComponentsUpdateBodySchema = bodyFromCoreSchema(
  'ServicePackageComponentsUpdateRequest',
  {
    serviceIds: z
      .array(z.string())
      .optional()
      .openapi({
        example: ['svc-1', 'svc-2'],
      }),
  },
  servicePackageComponentsUpdateSchema,
)

const servicePackageBookingTaskInputOpenApiSchema = z
  .object({
    packageComponentId: z.string(),
    staffId: z.string(),
    startTime: z.string().openapi({ example: '10:00' }),
    endTime: z.string().openapi({ example: '11:00' }),
  })
  .openapi('ServicePackageBookingTaskInput')

export const servicePackageBookingCreateBodySchema = bodyFromCoreSchema(
  'ServicePackageBookingCreateRequest',
  {
    clientId: z.string().openapi({ example: 'client-1' }),
    date: z.string().openapi({ example: '2026-07-02' }),
    notes: z.string().optional(),
    tasks: z.array(servicePackageBookingTaskInputOpenApiSchema).openapi({
      example: [
        {
          packageComponentId: 'component-1',
          staffId: 'staff-1',
          startTime: '10:00',
          endTime: '11:00',
        },
      ],
    }),
  },
  servicePackageBookingCreateSchema,
)

export const servicesListResponseSchema = z
  .object({
    services: z.array(serviceSchema),
  })
  .openapi('ServicesListResponse')

export const serviceResponseSchema = z
  .object({
    service: serviceSchema,
  })
  .openapi('ServiceResponse')

export const serviceCategoriesListResponseSchema = z
  .object({
    categories: z.array(serviceCategorySchema),
  })
  .openapi('ServiceCategoriesListResponse')

export const serviceCategoryResponseSchema = z
  .object({
    category: serviceCategorySchema,
  })
  .openapi('ServiceCategoryResponse')

export const serviceFamiliesListResponseSchema = z
  .object({
    families: z.array(serviceFamilySchema),
  })
  .openapi('ServiceFamiliesListResponse')

export const serviceFamilyResponseSchema = z
  .object({
    family: serviceFamilySchema,
  })
  .openapi('ServiceFamilyResponse')

export const serviceAddonsListResponseSchema = z
  .object({
    addons: z.array(serviceAddonSchema),
  })
  .openapi('ServiceAddonsListResponse')

export const serviceAddonResponseSchema = z
  .object({
    addon: serviceAddonSchema,
  })
  .openapi('ServiceAddonResponse')

export const servicePackagesListResponseSchema = z
  .object({
    packages: z.array(servicePackageSchema),
  })
  .openapi('ServicePackagesListResponse')

export const servicePackageResponseSchema = z
  .object({
    package: servicePackageSchema,
  })
  .openapi('ServicePackageResponse')

export const servicePackageBookingResponseSchema = z
  .object({
    booking: servicePackageBookingSchema,
  })
  .openapi('ServicePackageBookingResponse')

export const importStarterTemplatesResponseSchema = z
  .object({
    categories: z.array(serviceCategorySchema),
    services: z.array(serviceSchema),
  })
  .openapi('ImportStarterTemplatesResponse')

export const catalogPresetTreeSchema = z
  .array(
    z.object({
      name: z.string(),
      services: z.array(
        z.object({
          name: z.string(),
          duration: z.number().int(),
          price: z.number(),
          color: z.string(),
          description: z.string().optional(),
        }),
      ),
    }),
  )
  .openapi('CatalogPresetTree')

export const catalogPresetListItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    tree: catalogPresetTreeSchema,
    sortOrder: z.number().int(),
    disabled: z.boolean(),
    disabledReason: z.enum(['collision']).nullable(),
  })
  .openapi('CatalogPresetListItem')

export const catalogPresetsListResponseSchema = z
  .object({
    presets: z.array(catalogPresetListItemSchema),
  })
  .openapi('CatalogPresetsListResponse')

export const applyCatalogPresetBodySchemaOpenApi = bodyFromCoreSchema(
  'ApplyCatalogPresetRequest',
  {
    selection: z
      .array(
        z.object({
          categoryIndex: z.number().int().nonnegative(),
          serviceIndices: z.array(z.number().int().nonnegative()).min(1),
        }),
      )
      .min(1),
  },
  applyCatalogPresetBodySchema,
)

export const applyCatalogPresetResponseSchema = z
  .object({
    importedCategoryIds: z.array(z.string()),
    importedVariantIds: z.array(z.string()),
  })
  .openapi('ApplyCatalogPresetResponse')
